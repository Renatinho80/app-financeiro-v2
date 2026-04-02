"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionFilters } from "@/types";
import type { TransactionFormData } from "@/lib/validations/transaction";
import { toast } from "sonner";
import { addMonths, addWeeks, addDays, addYears, format } from "date-fns";

const PAGE_SIZE = 20;

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async (filters?: TransactionFilters, pageNum = 1) => {
    setLoading(true);
    const supabase = createClient();
    const from = (pageNum - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("transactions")
      .select("*, account:accounts!transactions_account_id_fkey(*), credit_card:credit_cards(*), destination_account:accounts!transactions_destination_account_id_fkey(*), category:categories(*)", { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters?.type) query = query.eq("type", filters.type);
    if (filters?.category_id) query = query.eq("category_id", filters.category_id);
    if (filters?.account_id) query = query.eq("account_id", filters.account_id);
    if (filters?.credit_card_id) query = query.eq("credit_card_id", filters.credit_card_id);
    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.startDate) query = query.gte("date", filters.startDate);
    if (filters?.endDate) query = query.lte("date", filters.endDate);
    if (filters?.search) query = query.ilike("description", `%${filters.search}%`);

    const { data, error, count } = await query;

    if (error) {
      toast.error("Erro ao carregar transações", { description: error.message });
    } else {
      setTransactions((data as Transaction[]) || []);
      setTotal(count || 0);
      setPage(pageNum);
    }
    setLoading(false);
  }, []);

  // Helper: resolve invoice_id for credit card transactions
  const resolveInvoiceId = async (
    supabase: ReturnType<typeof createClient>,
    creditCardId: string,
    userId: string,
    transactionDate: string
  ): Promise<string | null> => {
    const { data, error } = await supabase.rpc("get_or_create_invoice", {
      _credit_card_id: creditCardId,
      _user_id: userId,
      _transaction_date: transactionDate,
    });
    if (error) {
      console.error("Erro ao obter/criar fatura:", error.message);
      return null;
    }
    return data as string;
  };

  const createTransaction = async (formData: TransactionFormData) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { tag_ids, ...txData } = formData;

    // Handle installments
    if (txData.is_installment && txData.installment_total && txData.installment_total > 1) {
      const groupId = crypto.randomUUID();
      const installmentAmount = txData.amount / txData.installment_total;
      const txs = [];

      for (let i = 1; i <= txData.installment_total; i++) {
        const dateObj = new Date(txData.date);
        const installmentDate = addMonths(dateObj, i - 1);
        const installmentDateStr = format(installmentDate, "yyyy-MM-dd");

        // Resolve invoice for each installment if using credit card
        let invoiceId: string | null = null;
        if (txData.credit_card_id) {
          invoiceId = await resolveInvoiceId(supabase, txData.credit_card_id, user.id, installmentDateStr);
        }

        txs.push({
          ...txData,
          user_id: user.id,
          amount: Math.round(installmentAmount * 100) / 100,
          installment_number: i,
          installment_group_id: groupId,
          date: installmentDateStr,
          description: `${txData.description} (${i}/${txData.installment_total})`,
          invoice_id: invoiceId,
        });
      }

      const { error } = await supabase.from("transactions").insert(txs);
      if (error) {
        toast.error("Erro ao criar parcelas", { description: error.message });
        return false;
      }
      toast.success(`${txData.installment_total} parcelas criadas!`);
    }
    // Handle recurring
    else if (txData.is_recurring && txData.recurrence_type) {
      const groupId = crypto.randomUUID();
      const baseDate = new Date(txData.date);
      const endDate = txData.recurrence_end_date ? new Date(txData.recurrence_end_date) : addMonths(baseDate, 12);
      const txs = [];
      let currentDate = baseDate;

      while (currentDate <= endDate) {
        const dateStr = format(currentDate, "yyyy-MM-dd");

        // Resolve invoice for each occurrence if using credit card
        let invoiceId: string | null = null;
        if (txData.credit_card_id) {
          invoiceId = await resolveInvoiceId(supabase, txData.credit_card_id, user.id, dateStr);
        }

        txs.push({
          ...txData,
          user_id: user.id,
          recurrence_group_id: groupId,
          date: dateStr,
          invoice_id: invoiceId,
        });

        switch (txData.recurrence_type) {
          case "daily": currentDate = addDays(currentDate, 1); break;
          case "weekly": currentDate = addWeeks(currentDate, 1); break;
          case "monthly": currentDate = addMonths(currentDate, 1); break;
          case "yearly": currentDate = addYears(currentDate, 1); break;
        }
      }

      const { error } = await supabase.from("transactions").insert(txs);
      if (error) {
        toast.error("Erro ao criar recorrências", { description: error.message });
        return false;
      }
      toast.success(`${txs.length} transações recorrentes criadas!`);
    }
    // Single transaction
    else {
      // Resolve invoice if using credit card
      let invoiceId: string | null = null;
      if (txData.credit_card_id) {
        invoiceId = await resolveInvoiceId(supabase, txData.credit_card_id, user.id, txData.date);
      }

      const { error, data: newTx } = await supabase
        .from("transactions")
        .insert({ ...txData, user_id: user.id, invoice_id: invoiceId })
        .select()
        .single();

      if (error) {
        toast.error("Erro ao criar transação", { description: error.message });
        return false;
      }

      // Add tags
      if (tag_ids && tag_ids.length > 0 && newTx) {
        await supabase.from("transaction_tags").insert(
          tag_ids.map(tagId => ({ transaction_id: newTx.id, tag_id: tagId }))
        );
      }

      // Note: account balance updates are handled by database triggers now
      toast.success("Transação criada com sucesso!");
    }

    return true;
  };

  const updateTransaction = async (id: string, data: Partial<TransactionFormData>) => {
    const supabase = createClient();
    const { tag_ids, ...txData } = data;
    const { error } = await supabase.from("transactions").update(txData).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar transação", { description: error.message });
      return false;
    }

    if (tag_ids) {
      await supabase.from("transaction_tags").delete().eq("transaction_id", id);
      if (tag_ids.length > 0) {
        await supabase.from("transaction_tags").insert(
          tag_ids.map(tagId => ({ transaction_id: id, tag_id: tagId }))
        );
      }
    }

    toast.success("Transação atualizada!");
    return true;
  };

  const deleteTransaction = async (id: string, deleteAll = false, groupField?: string, groupId?: string) => {
    const supabase = createClient();

    if (deleteAll && groupField && groupId) {
      const { error } = await supabase.from("transactions").delete().eq(groupField, groupId);
      if (error) {
        toast.error("Erro ao excluir transações", { description: error.message });
        return false;
      }
      toast.success("Todas as ocorrências excluídas!");
    } else {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) {
        toast.error("Erro ao excluir transação", { description: error.message });
        return false;
      }
      toast.success("Transação excluída!");
    }
    return true;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return {
    transactions, loading, total, page, totalPages,
    fetchTransactions, createTransaction, updateTransaction, deleteTransaction, setPage,
  };
}
