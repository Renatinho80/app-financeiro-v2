import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string | null;
  icon: string | null;
  deadline: string | null;
};

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar metas", { description: error.message });
    } else {
      setGoals(data as Goal[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const createGoal = async (goalContent: Omit<Goal, "id">) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Convert date string if empty to null
    const payload = {
       ...goalContent,
       deadline: goalContent.deadline ? goalContent.deadline : null,
       user_id: user.id
    };

    const { error } = await supabase.from("goals").insert([payload]);

    if (error) {
      toast.error("Erro ao criar meta", { description: error.message });
      return false;
    }

    toast.success("Meta criada com sucesso!");
    fetchGoals();
    return true;
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    const supabase = createClient();
    
    const payload = { ...updates };
    if (payload.deadline === "") payload.deadline = null;

    const { error } = await supabase.from("goals").update(payload).eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar meta", { description: error.message });
      return false;
    }

    toast.success("Meta atualizada com sucesso!");
    fetchGoals();
    return true;
  };

  const deleteGoal = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("goals").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir meta", { description: error.message });
      return false;
    }

    toast.success("Meta excluída com sucesso!");
    fetchGoals();
    return true;
  };

  return {
    goals,
    loading,
    fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal
  };
}
