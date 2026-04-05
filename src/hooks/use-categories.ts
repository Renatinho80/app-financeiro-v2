"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";
import { toast } from "sonner";

const fetcher = async () => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  
  // Build hierarchy
  const allCats = (data as Category[]) || [];
  const parents = allCats.filter(c => !c.parent_id);
  const withSubs = parents.map(p => ({
    ...p,
    subcategories: allCats.filter(c => c.parent_id === p.id),
  }));
  return withSubs;
};

export function useCategories() {
  const { data: categories = [], error, isLoading, mutate } = useSWR("categories", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
    errorRetryCount: 3,
  });

  const allFlat = useMemo(() => {
    const flat: Category[] = [];
    categories.forEach(c => {
      flat.push(c);
      if (c.subcategories) flat.push(...c.subcategories);
    });
    return flat;
  }, [categories]);

  const createCategory = async (data: Partial<Category>) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase.from("categories").insert({ ...data, user_id: user.id });
    if (error) {
      toast.error("Erro ao criar categoria", { description: error.message });
      return false;
    }
    toast.success("Categoria criada com sucesso!");
    mutate();
    return true;
  };

  const updateCategory = async (id: string, data: Partial<Category>) => {
    const supabase = createClient();
    const { error } = await supabase.from("categories").update(data).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar categoria", { description: error.message });
      return false;
    }
    toast.success("Categoria atualizada com sucesso!");
    mutate();
    return true;
  };

  const deleteCategory = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir categoria", { description: error.message });
      return false;
    }
    toast.success("Categoria excluída com sucesso!");
    mutate();
    return true;
  };

  const deleteCategoryWithReassign = async (id: string, newCategoryId: string) => {
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("transactions")
      .update({ category_id: newCategoryId })
      .eq("category_id", id);
    if (updateErr) {
      toast.error("Erro ao reatribuir transações", { description: updateErr.message });
      return false;
    }
    const { error: deleteErr } = await supabase.from("categories").delete().eq("id", id);
    if (deleteErr) {
      toast.error("Erro ao excluir categoria", { description: deleteErr.message });
      return false;
    }
    toast.success("Transações reatribuídas e categoria excluída!");
    mutate();
    return true;
  };

  return {
    categories,
    loading: isLoading,
    error,
    allFlat,
    createCategory,
    updateCategory,
    deleteCategory,
    deleteCategoryWithReassign,
    refetch: mutate
  };
}
