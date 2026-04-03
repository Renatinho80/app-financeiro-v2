"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Invoice } from "@/types";
import { toast } from "sonner";

export function useInvoices(creditCardId?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("invoices")
      .select("*, credit_card:credit_cards(*)")
      .order("due_date", { ascending: false });

    if (creditCardId) {
      query = query.eq("credit_card_id", creditCardId);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar faturas", { description: error.message });
    } else {
      setInvoices((data as Invoice[]) || []);
    }
    setLoading(false);
  }, [creditCardId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const markAsPaid = async (id: string, accountId: string) => {
    const supabase = createClient();
    
    // 1. Buscar dados da fatura para a transação
    const { data: invoice } = await supabase
      .from("invoices")
      .select("total_amount, reference_month, credit_card:credit_cards(name)")
      .eq("id", id)
      .single();

    if (!invoice) {
      toast.error("Fatura não encontrada");
      return false;
    }

    const cardName = (invoice.credit_card as any)?.name || "Cartão";
    const refMonth = new Date(invoice.reference_month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    // 2. Criar transação de pagamento (débito da conta)
    const { data: newTx, error: txError } = await supabase.from("transactions").insert({
      description: `Pagamento Fatura ${cardName} - ${refMonth}`,
      amount: invoice.total_amount,
      type: "expense", // Usamos expense para debitar o saldo via trigger
      date: new Date().toISOString().split("T")[0],
      account_id: accountId,
      status: "confirmed",
      user_id: (await supabase.auth.getUser()).data.user?.id
    }).select("id").single();

    if (txError) {
      toast.error("Erro ao criar transação de pagamento", { description: txError.message });
      return false;
    }

    // 3. Atualizar status da fatura
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      // Rollback: desfaz o débito para manter consistência
      if (newTx?.id) {
        await supabase.from("transactions").delete().eq("id", newTx.id);
      }
      toast.error("Erro ao marcar fatura como paga. Débito revertido.", { description: error.message });
      return false;
    }

    toast.success("Fatura paga e saldo atualizado!");
    await fetchInvoices();
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
    await fetchInvoices();
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
    await fetchInvoices();
    return true;
  };

  return { invoices, loading, markAsPaid, createInvoice, reopenInvoice, refetch: fetchInvoices };
}
