"use client";

import { mutate as globalMutate } from "swr";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, TransactionFilters } from "@/types";
import type { TransactionFormData } from "@/lib/validations/transaction";
import { toast } from "sonner";
import { addMonths, addWeeks, addDays, addYears, format } from "date-fns";

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTransactions = useCallback(async (filters?: TransactionFilters, pageNum = 1, size = 20) => {
    setLoading(true);
    const supabase = createClient();
    const from = (pageNum - 1) * size;
    const to = from + size - 1;

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
      setTotalPages(Math.ceil((count || 0) / size));
    }
    setLoading(false);
  }, []);

  // Helper: resolve invoice_id for credit card transactions
  const resolveInvoiceId = async (
    supabase: ReturnType<typeof createClient>,
    creditCardId: string,
    transactionDate: string
  ): Promise<string | null> => {
    const { data, error } = await supabase.rpc("get_or_create_invoice", {
      _credit_card_id: creditCardId,
      _transaction_date: transactionDate,
    });
    if (error) {
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
          invoiceId = await resolveInvoiceId(supabase, txData.credit_card_id, installmentDateStr);
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
      globalMutate("accounts");
      globalMutate("credit_cards");
    }
    // Handle recurring
    else if (txData.is_recurring && txData.recurrence_type) {
      const groupId = crypto.randomUUID();
      const baseDate = new Date(txData.date);
      const endDate = txData.recurrence_end_date ? new Date(txData.recurrence_end_date) : addMonths(baseDate, 3);
      // Só cria fatura para o mês atual + próximo mês — evita proliferação de faturas futuras
      const invoiceHorizon = addMonths(new Date(), 1);
      const txs = [];
      let currentDate = baseDate;

      while (currentDate <= endDate) {
        const dateStr = format(currentDate, "yyyy-MM-dd");

        // Resolve invoice apenas para o ciclo atual e o próximo
        let invoiceId: string | null = null;
        if (txData.credit_card_id && currentDate <= invoiceHorizon) {
          invoiceId = await resolveInvoiceId(supabase, txData.credit_card_id, dateStr);
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
      globalMutate("accounts");
      globalMutate("credit_cards");
    }
    // Single transaction
    else {
      // Resolve invoice if using credit card
      let invoiceId: string | null = null;
      if (txData.credit_card_id) {
        invoiceId = await resolveInvoiceId(supabase, txData.credit_card_id, txData.date);
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
      globalMutate("accounts");
      globalMutate("credit_cards");
    }

    return true;
  };

  const updateTransaction = async (id: string, data: Partial<TransactionFormData>) => {
    const supabase = createClient();
    const { tag_ids, ...txData } = data;

    // Sincroniza invoice_id quando o cartão de crédito ou a data são alterados.
    // TransactionFormData não inclui invoice_id, então precisamos resolvê-lo aqui.
    const updatePayload: typeof txData & { invoice_id?: string | null } = { ...txData };

    if ("credit_card_id" in txData || "date" in txData) {
      const { data: existing } = await supabase
        .from("transactions")
        .select("credit_card_id, date")
        .eq("id", id)
        .single();

      const effectiveCardId = "credit_card_id" in txData ? txData.credit_card_id : existing?.credit_card_id;
      const effectiveDate = txData.date ?? existing?.date;

      if (effectiveCardId && effectiveDate) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          updatePayload.invoice_id = await resolveInvoiceId(supabase, effectiveCardId, effectiveDate);
        }
      } else if (effectiveCardId === null || effectiveCardId === undefined) {
        updatePayload.invoice_id = null;
      }
    }

    const { error } = await supabase.from("transactions").update(updatePayload).eq("id", id);
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
    globalMutate("accounts");
    globalMutate("credit_cards");
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
    
    // Atualizar saldos globais
    globalMutate("accounts");
    globalMutate("credit_cards");
    
    return true;
  };

  return {
    transactions, loading, total, page, totalPages, pageSize,
    fetchTransactions, createTransaction, updateTransaction, deleteTransaction, setPage,
  };
}
