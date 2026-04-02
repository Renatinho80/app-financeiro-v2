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

  const markAsPaid = async (id: string, accountId?: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao marcar fatura como paga", { description: error.message });
      return false;
    }
    toast.success("Fatura marcada como paga!");
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
