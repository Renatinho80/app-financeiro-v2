"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/types";
import { toast } from "sonner";

const fetcher = async () => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Account[];
};

export function useAccounts() {
  const { data: accounts = [], error, isLoading, mutate } = useSWR("accounts", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
    errorRetryCount: 3,
  });

  const createAccount = async (data: Partial<Account>) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("accounts").insert({ ...data, user_id: user.id });
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      return false;
    }
    toast.success("Conta criada com sucesso!");
    mutate(); // Refresh globally instantly
    return true;
  };

  const updateAccount = async (id: string, data: Partial<Account>) => {
    const supabase = createClient();
    const { error } = await supabase.from("accounts").update(data).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar conta", { description: error.message });
      return false;
    }
    toast.success("Conta atualizada com sucesso!");
    mutate();
    return true;
  };

  const deleteAccount = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir conta", { description: error.message });
      return false;
    }
    toast.success("Conta excluída com sucesso!");
    mutate();
    return true;
  };

  const totalBalance = accounts.filter(a => a.is_active).reduce((sum, a) => sum + Number(a.balance), 0);

  return { 
    accounts, 
    loading: isLoading, 
    error,
    totalBalance, 
    createAccount, 
    updateAccount, 
    deleteAccount, 
    refetch: mutate 
  };
}
