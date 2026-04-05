"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Budget } from "@/types";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";

const makeFetcher = (month: string) => async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("budgets")
    .select("*, category:categories(id, name, color, icon, type)")
    .eq("user_id", user.id)
    .eq("month", `${month}-01`)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as Budget[];
};

export function useBudgets(month: string) {
  const { data: budgets = [], error, isLoading, mutate } = useSWR(
    `budgets-${month}`,
    makeFetcher(month),
    { revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 30_000 }
  );

  const createBudget = async (categoryId: string, amount: number) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.from("budgets").insert({
      user_id: user.id,
      category_id: categoryId,
      amount,
      month: `${month}-01`,
    });

    if (error) { toast.error("Erro ao criar orçamento", { description: error.message }); return false; }
    toast.success("Orçamento criado!");
    mutate();
    return true;
  };

  const updateBudget = async (id: string, amount: number) => {
    const supabase = createClient();
    const { error } = await supabase.from("budgets").update({ amount }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar orçamento", { description: error.message }); return false; }
    toast.success("Orçamento atualizado!");
    mutate();
    return true;
  };

  const deleteBudget = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir orçamento", { description: error.message }); return false; }
    toast.success("Orçamento excluído!");
    mutate();
    return true;
  };

  const copyFromPreviousMonth = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const [year, monthNum] = month.split("-").map(Number);
    const prevMonth = format(subMonths(new Date(year, monthNum - 1, 1), 1), "yyyy-MM");

    const { data: prev, error: fetchErr } = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", user.id)
      .eq("month", `${prevMonth}-01`);

    if (fetchErr || !prev?.length) {
      toast.error("Nenhum orçamento encontrado no mês anterior.");
      return false;
    }

    const existingCatIds = new Set(budgets.map(b => b.category_id));
    const toInsert = prev
      .filter(b => !existingCatIds.has(b.category_id))
      .map(b => ({ user_id: user.id, category_id: b.category_id, amount: b.amount, month: `${month}-01` }));

    if (!toInsert.length) {
      toast.info("Todos os orçamentos do mês anterior já foram adicionados.");
      return false;
    }

    const { error } = await supabase.from("budgets").insert(toInsert);
    if (error) { toast.error("Erro ao copiar orçamentos", { description: error.message }); return false; }
    toast.success(`${toInsert.length} orçamento(s) copiado(s)!`);
    mutate();
    return true;
  };

  return { budgets, loading: isLoading, error, createBudget, updateBudget, deleteBudget, copyFromPreviousMonth, refetch: mutate };
}
