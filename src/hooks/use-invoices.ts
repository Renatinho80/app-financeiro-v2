"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/types";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// localStorage helpers — tracks invoices that were manually reopened so that
// the auto-close rule (due_date < today) does NOT apply to them.
// ---------------------------------------------------------------------------
const LS_REOPENED = "reopened_invoice_ids";

function getReopenedIds(): Set<string> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_REOPENED) : null;
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function addReopenedId(id: string) {
  const ids = getReopenedIds();
  ids.add(id);
  localStorage.setItem(LS_REOPENED, JSON.stringify([...ids]));
}

function removeReopenedId(id: string) {
  const ids = getReopenedIds();
  ids.delete(id);
  localStorage.setItem(LS_REOPENED, JSON.stringify([...ids]));
}

const buildKey = (creditCardId?: string) => creditCardId ? `invoices:${creditCardId}` : "invoices";

const fetcher = async (creditCardId?: string) => {
  const supabase = createClient();
  let query = supabase
    .from("invoices")
    .select("id, status, reference_month, closing_date, due_date, total_amount, paid_at, created_at, credit_card_id, user_id, credit_card:credit_cards(id, name, color, closing_day, due_day)")
    .order("due_date", { ascending: false });

  if (creditCardId) query = query.eq("credit_card_id", creditCardId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Invoice[]) || [];
};

export function useInvoices(creditCardId?: string) {
  const key = buildKey(creditCardId);

  const { data: invoices = [], error, isLoading, mutate } = useSWR(
    key,
    () => fetcher(creditCardId),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 15_000,
      errorRetryCount: 3,
    }
  );

  if (error) toast.error("Erro ao carregar faturas", { description: error.message });

  const markAsPaid = async (id: string, accountId: string | null) => {
    const supabase = createClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("total_amount, reference_month, credit_card:credit_cards(name)")
      .eq("id", id)
      .single();

    if (!invoice) {
      toast.error("Fatura não encontrada");
      return false;
    }

    let newTxId: string | null = null;

    if (accountId) {
      const cardName = (invoice.credit_card as any)?.name || "Cartão";
      const refMonth = new Date(invoice.reference_month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      const { data: newTx, error: txError } = await supabase.from("transactions").insert({
        description: `Pagamento Fatura ${cardName} - ${refMonth}`,
        amount: invoice.total_amount,
        type: "expense",
        date: new Date().toISOString().split("T")[0],
        account_id: accountId,
        status: "confirmed",
        user_id: (await supabase.auth.getUser()).data.user?.id,
      }).select("id").single();

      if (txError) {
        toast.error("Erro ao criar transação de pagamento", { description: txError.message });
        return false;
      }

      newTxId = newTx?.id ?? null;
    }

    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      if (newTxId) await supabase.from("transactions").delete().eq("id", newTxId);
      toast.error("Erro ao marcar fatura como paga. Débito revertido.", { description: error.message });
      return false;
    }

    toast.success(accountId ? "Fatura paga e saldo atualizado!" : "Fatura marcada como paga!");
    removeReopenedId(id);
    globalMutate("invoices");
    if (creditCardId) globalMutate(`invoices:${creditCardId}`);
    return true;
  };

  const createInvoice = async (data: Partial<Invoice>) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.from("invoices").insert({ ...data, user_id: user.id });
    if (error) {
      toast.error("Erro ao criar fatura", { description: error.message });
      return false;
    }
    globalMutate("invoices");
    return true;
  };

  const reopenInvoice = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status: "open", paid_at: null })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao reabrir fatura", { description: error.message });
      return false;
    }
    // Mark as manually reopened — auto-close will skip this invoice
    addReopenedId(id);
    toast.success("Fatura reaberta! Feche manualmente quando quiser.");
    globalMutate("invoices");
    if (creditCardId) globalMutate(`invoices:${creditCardId}`);
    return true;
  };

  // Manually close a reopened invoice (the only way to close it after reopening)
  const closeInvoice = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status: "closed" })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao fechar fatura", { description: error.message });
      return false;
    }
    removeReopenedId(id);
    toast.success("Fatura fechada com sucesso!");
    globalMutate("invoices");
    if (creditCardId) globalMutate(`invoices:${creditCardId}`);
    return true;
  };

  // Enforces the two lifecycle rules on every page visit:
  //
  // Rule A — AUTO-CLOSE: open invoices whose due_date has already passed
  //   → status transitions open → closed automatically.
  //
  // Rule B — AUTO-ADVANCE: for every active credit card, create all missing
  //   invoices from the period after the last known one up to today.
  //   Triggered by closing_date passing; works regardless of previous status.
  //   Installment-created future invoices are NOT touched (they already exist).
  const autoAdvanceInvoices = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Rule A: close open invoices whose due_date is in the past,
    // EXCEPT those manually reopened by the user (tracked in localStorage).
    const reopenedIds = getReopenedIds();
    const { data: overdueOpen } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "open")
      .lt("due_date", todayStr);

    const toClose = (overdueOpen ?? [])
      .map(inv => inv.id)
      .filter(id => !reopenedIds.has(id));

    if (toClose.length > 0) {
      await supabase
        .from("invoices")
        .update({ status: "closed" })
        .in("id", toClose);
    }

    // Rule B: create missing invoices for each active credit card
    const { data: cards } = await supabase
      .from("credit_cards")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    // Always refresh cache — Rule A may have changed statuses even with no new invoices
    if (!cards?.length) {
      globalMutate("invoices");
      if (creditCardId) globalMutate(`invoices:${creditCardId}`);
      return;
    }

    for (const card of cards) {
      // Most recent invoice for this card (any status) determines where to start
      const { data: latest } = await supabase
        .from("invoices")
        .select("closing_date")
        .eq("credit_card_id", card.id)
        .order("closing_date", { ascending: false })
        .limit(1)
        .single();

      // Cursor: day after the last known closing_date (or today if no invoices yet)
      let cursor = new Date(latest ? latest.closing_date : todayStr);
      cursor.setDate(cursor.getDate() + 1);

      // Iterate forward, one billing period at a time, until cursor > today
      // Safety cap: 24 iterations max (~2 years of monthly cycles)
      for (let guard = 0; guard < 24 && cursor <= today; guard++) {
        const cursorStr = cursor.toISOString().split("T")[0];

        // _ignore_closed=true lets us traverse past paid/closed periods safely
        const { data: newId, error } = await supabase.rpc("get_or_create_invoice", {
          _credit_card_id: card.id,
          _transaction_date: cursorStr,
          _ignore_closed: true,
        });

        if (error || !newId) break;

        // Use the returned invoice's closing_date to compute the next cursor
        const { data: inv } = await supabase
          .from("invoices")
          .select("closing_date")
          .eq("id", newId)
          .single();

        if (!inv) break;

        cursor = new Date(inv.closing_date);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    globalMutate("invoices");
    if (creditCardId) globalMutate(`invoices:${creditCardId}`);
  };

  return { invoices, loading: isLoading, markAsPaid, createInvoice, reopenInvoice, closeInvoice, autoAdvanceInvoices, getReopenedIds, refetch: mutate };
}
