"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CreditCard } from "@/types";
import { toast } from "sonner";

export function useCreditCards() {
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [usedAmountMap, setUsedAmountMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchCreditCards = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("credit_cards")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar cartões", { description: error.message });
    } else {
      const cards = (data as CreditCard[]) || [];
      setCreditCards(cards);

      // Fetch open invoice totals for each card
      if (cards.length > 0) {
        const cardIds = cards.map(c => c.id);
        const { data: openInvoices } = await supabase
          .from("invoices")
          .select("credit_card_id, total_amount")
          .in("credit_card_id", cardIds)
          .in("status", ["open", "closed"]);

        const usedMap: Record<string, number> = {};
        (openInvoices || []).forEach((inv: { credit_card_id: string; total_amount: number }) => {
          usedMap[inv.credit_card_id] = (usedMap[inv.credit_card_id] || 0) + Number(inv.total_amount);
        });
        setUsedAmountMap(usedMap);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCreditCards(); }, [fetchCreditCards]);

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
    await fetchCreditCards();
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
    await fetchCreditCards();
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
    await fetchCreditCards();
    return true;
  };

  const getAvailableLimit = (cardId: string, limitAmount: number) => {
    const used = usedAmountMap[cardId] || 0;
    return Math.max(0, limitAmount - used);
  };

  return {
    creditCards, loading, usedAmountMap,
    createCreditCard, updateCreditCard, deleteCreditCard,
    getAvailableLimit, refetch: fetchCreditCards,
  };
}

