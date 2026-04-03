"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { CreditCard } from "@/types";
import { toast } from "sonner";

const fetcher = async () => {
  const supabase = createClient();
  const { data: cards, error: cardsError } = await supabase
    .from("credit_cards")
    .select("*")
    .order("created_at", { ascending: true });

  if (cardsError) throw cardsError;

  const usedMap: Record<string, number> = {};
  
  if (cards && cards.length > 0) {
    const cardIds = cards.map(c => c.id);
    const { data: openInvoices } = await supabase
      .from("invoices")
      .select("credit_card_id, total_amount")
      .in("credit_card_id", cardIds)
      .in("status", ["open", "closed"]);

    (openInvoices || []).forEach((inv: { credit_card_id: string; total_amount: number }) => {
      usedMap[inv.credit_card_id] = (usedMap[inv.credit_card_id] || 0) + Number(inv.total_amount);
    });
  }

  return { cards: cards as CreditCard[], usedAmountMap: usedMap };
};

export function useCreditCards() {
  const { data, error, isLoading, mutate } = useSWR("credit_cards", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
    errorRetryCount: 3,
  });

  const creditCards = data?.cards || [];
  const usedAmountMap = data?.usedAmountMap || {};

  const createCreditCard = async (data: Partial<CreditCard>) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.from("credit_cards").insert({ ...data, user_id: user.id });
    if (error) {
      toast.error("Erro ao criar cartão", { description: error.message });
      return false;
    }
    toast.success("Cartão criado com sucesso!");
    mutate();
    return true;
  };

  const updateCreditCard = async (id: string, data: Partial<CreditCard>) => {
    const supabase = createClient();
    const { error } = await supabase.from("credit_cards").update(data).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar cartão", { description: error.message });
      return false;
    }
    toast.success("Cartão atualizado com sucesso!");
    mutate();
    return true;
  };

  const deleteCreditCard = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("credit_cards").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir cartão", { description: error.message });
      return false;
    }
    toast.success("Cartão excluído com sucesso!");
    mutate();
    return true;
  };

  const getAvailableLimit = (cardId: string, limitAmount: number) => {
    const used = usedAmountMap[cardId] || 0;
    return Math.max(0, limitAmount - used);
  };

  return {
    creditCards, 
    loading: isLoading, 
    error,
    usedAmountMap,
    createCreditCard, 
    updateCreditCard, 
    deleteCreditCard,
    getAvailableLimit, 
    refetch: mutate,
  };
}
