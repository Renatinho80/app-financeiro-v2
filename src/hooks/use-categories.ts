"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";
import { toast } from "sonner";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar categorias", { description: error.message });
    } else {
      // Build hierarchy
      const allCats = (data as Category[]) || [];
      const parents = allCats.filter(c => !c.parent_id);
      const withSubs = parents.map(p => ({
        ...p,
        subcategories: allCats.filter(c => c.parent_id === p.id),
      }));
      setCategories(withSubs);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const allFlat = useCallback(() => {
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
    await fetchCategories();
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
    await fetchCategories();
    return true;
  };

  const deleteCategory = async (id: string) => {
    const supabase = createClient();
    // Check if category has transactions
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (count && count > 0) {
      toast.error("Não é possível excluir", {
        description: `Esta categoria possui ${count} transação(ões) vinculada(s). Reatribua-as antes de excluir.`,
      });
      return false;
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir categoria", { description: error.message });
      return false;
    }
    toast.success("Categoria excluída com sucesso!");
    await fetchCategories();
    return true;
  };

  return { categories, loading, allFlat, createCategory, updateCategory, deleteCategory, refetch: fetchCategories };
}
