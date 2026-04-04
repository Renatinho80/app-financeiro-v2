"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/types";
import { toast } from "sonner";

const buildKey = (creditCardId?: string) => creditCardId ? `invoices:${creditCardId}` : "invoices";

const fetcher = async (creditCardId?: string) => {
  const supabase = createClient();
  let query = supabase
    .from("invoices")
    .select("id, status, reference_month, closing_date, due_date, total_amount, paid_at, credit_card_id, user_id, credit_card:credit_cards(id, name, color, closing_day, due_day)")
    .order("due_date", { ascending: false });

  if (creditCardId) query = query.eq("credit_card_id", creditCardId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Invoice[]) || [];
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
    toast.success("Fatura reaberta com sucesso!");
    globalMutate("invoices");
    if (creditCardId) globalMutate(`invoices:${creditCardId}`);
    return true;
  };

  return { invoices, loading: isLoading, markAsPaid, createInvoice, reopenInvoice, refetch: mutate };
}
