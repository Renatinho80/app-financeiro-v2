"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/types";
import { toast } from "sonner";

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar contas", { description: error.message });
    } else {
      setAccounts((data as Account[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

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
    await fetchAccounts();
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
    await fetchAccounts();
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
    await fetchAccounts();
    return true;
  };

  const totalBalance = accounts.filter(a => a.is_active).reduce((sum, a) => sum + Number(a.balance), 0);

  return { accounts, loading, totalBalance, createAccount, updateAccount, deleteAccount, refetch: fetchAccounts };
}
