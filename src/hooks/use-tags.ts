"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tag } from "@/types";
import { toast } from "sonner";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar tags", { description: error.message });
    } else {
      setTags((data as Tag[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const createTag = async (name: string, color?: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("tags")
      .insert({ name, color, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar tag", { description: error.message });
      return null;
    }
    await fetchTags();
    return data as Tag;
  };

  const deleteTag = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir tag", { description: error.message });
      return false;
    }
    toast.success("Tag excluída!");
    await fetchTags();
    return true;
  };

  return { tags, loading, createTag, deleteTag, refetch: fetchTags };
}
