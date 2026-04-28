"use client";

import { useEffect, useState, useRef } from "react";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency, formatDate, formatShortMonth } from "@/lib/utils/format";
import { CHART_COLORS } from "@/lib/utils/constants";
import { TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, CreditCard, AlertTriangle, Sparkles, ShieldAlert, X, Pencil, Trash2, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import Link from "next/link";

type UpcomingInvoice = {
  id: string;
  total_amount: number;
  due_date: string;
  status: string;
  credit_card?: { name: string; color: string | null };
};

export default function DashboardPage() {
  const { cache } = useSWRConfig();
  const lastCacheStateRef = useRef<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [summary, setSummary] = useState({ totalBalance: 0, totalAccounts: 0, totalInvoicesDebt: 0, totalCreditCardSpending: 0, monthIncome: 0, monthExpenses: 0, monthBalance: 0 });
  const [categoryExpenses, setCategoryExpenses] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number; balance: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<{ id: string; description: string; amount: number; type: string; date: string }[]>([]);
  const [upcomingInvoices, setUpcomingInvoices] = useState<UpcomingInvoice[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<{ name: string; icon: string | null; pct: number; spent: number; budget: number }[]>([]);
  const [refetchCounter, setRefetchCounter] = useState(0);
  const [dismissedInvoiceIds, setDismissedInvoiceIds] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("dismissed_upcoming_invoices") : null;
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [spendingLimit, setSpendingLimit] = useState<number | null>(null);
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [year, month] = selectedMonth.split("-").map(Number);
      const selectedDate = new Date(year, month - 1);
      const start = format(startOfMonth(selectedDate), "yyyy-MM-dd");
      const end = format(endOfMonth(selectedDate), "yyyy-MM-dd");

      // Range cobrindo os últimos 6 meses para o gráfico
      const rangeStart = format(startOfMonth(subMonths(selectedDate, 5)), "yyyy-MM-dd");
      const today = new Date().toISOString().split("T")[0];
      const fifteenDays = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // Todas as queries em paralelo: reduz de ~18 chamadas sequenciais para 5 paralelas
      const [
        { data: accounts },
        { data: allTxns },
        { data: invoices },
        { data: catExp },
        { data: recent },
        { data: invoicesData },
        { data: creditCardTxns },
        { data: budgetsData },
        { data: profileData },
      ] = await Promise.all([
        // 1. Saldo das contas ativas
        supabase.from("accounts").select("balance").eq("user_id", user.id).eq("is_active", true),

        // 2. Todas receitas+despesas dos últimos 6 meses — inclui pending (exclui só cancelled)
        supabase.from("transactions").select("amount, type, date")
          .eq("user_id", user.id).neq("status", "cancelled")
          .in("type", ["income", "expense"])
          .gte("date", rangeStart).lte("date", end),

        // 3. Dívida total em faturas abertas/fechadas
        supabase.from("invoices").select("total_amount").eq("user_id", user.id).in("status", ["open", "closed"]),

        // 4. Despesas por categoria (mês selecionado, com join) — inclui pending
        supabase.from("transactions").select("amount, category_id, category:categories(name, color)")
          .eq("user_id", user.id).eq("type", "expense").neq("status", "cancelled")
          .gte("date", start).lte("date", end),

        // 5. Últimas transações
        supabase.from("transactions").select("id, description, amount, type, date")
          .eq("user_id", user.id)
          .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(10),

        // 6. Faturas próximas do vencimento (15 dias)
        supabase.from("invoices")
          .select("id, total_amount, due_date, status, credit_card:credit_cards(name, color)")
          .in("status", ["open", "closed"])
          .gte("due_date", today).lte("due_date", fifteenDays)
          .order("due_date", { ascending: true }),

        // 7. Total gasto em cartões de crédito de todo o tempo
        supabase.from("transactions").select("amount")
          .eq("user_id", user.id).eq("type", "expense").eq("status", "confirmed")
          .not("credit_card_id", "is", "null"),

        // 8. Orçamentos do mês selecionado
        supabase.from("budgets")
          .select("amount, category_id, category:categories(name, icon)")
          .eq("user_id", user.id)
          .eq("month", `${format(selectedDate, "yyyy-MM")}-01`),

        // 9. Limite de gastos personalizado
        supabase.from("profiles").select("spending_limit").eq("id", user.id).maybeSingle(),
      ]);

      // Saldo bancário
      const totalAccounts = (accounts || []).reduce((sum: number, a: { balance: number }) => sum + Number(a.balance), 0);
      const totalInvoicesDebt = (invoices || []).reduce((sum: number, i: { total_amount: number }) => sum + Number(i.total_amount), 0);
      const totalCreditCardSpending = (creditCardTxns || []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

      // Agrupar allTxns por mês para o gráfico — zero queries adicionais
      const monthMap = new Map<string, { income: number; expenses: number }>();
      for (let i = 5; i >= 0; i--) {
        monthMap.set(format(subMonths(selectedDate, i), "yyyy-MM"), { income: 0, expenses: 0 });
      }
      (allTxns || []).forEach((t: { amount: number; type: string; date: string }) => {
        const key = t.date.substring(0, 7);
        const entry = monthMap.get(key);
        if (!entry) return;
        if (t.type === "income") entry.income += Number(t.amount);
        else entry.expenses += Number(t.amount);
      });

      // Resumo do mês selecionado (extraído do allTxns, sem query extra)
      const currentKey = format(selectedDate, "yyyy-MM");
      const currentEntry = monthMap.get(currentKey) || { income: 0, expenses: 0 };
      const monthIncome = currentEntry.income;
      const monthExpenses = currentEntry.expenses;

      setSummary({
        totalBalance: totalAccounts - totalInvoicesDebt,
        totalAccounts,
        totalInvoicesDebt,
        totalCreditCardSpending,
        monthIncome,
        monthExpenses,
        monthBalance: monthIncome - monthExpenses,
      });

      // Gráfico: 6 meses com saldo acumulado
      let cumulativeBalance = 0;
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(selectedDate, i);
        const entry = monthMap.get(format(d, "yyyy-MM")) || { income: 0, expenses: 0 };
        cumulativeBalance += entry.income - entry.expenses;
        months.push({ month: formatShortMonth(d), income: entry.income, expenses: entry.expenses, balance: cumulativeBalance });
      }
      setMonthlyData(months);

      // Despesas por categoria + mapa por category_id para orçamentos
      const catMap = new Map<string, { name: string; value: number; color: string }>();
      const spendingByCatId = new Map<string, number>();
      (catExp || []).forEach((t: { amount: number; category_id?: string; category: unknown }) => {
        const cat = Array.isArray(t.category) ? t.category[0] : (t.category as { name: string; color: string | null } | null);
        const name = cat?.name || "Sem categoria";
        const color = (cat as { color?: string | null })?.color || "#64748b";
        const existing = catMap.get(name);
        if (existing) existing.value += Number(t.amount);
        else catMap.set(name, { name, value: Number(t.amount), color });
        if (t.category_id) spendingByCatId.set(t.category_id, (spendingByCatId.get(t.category_id) || 0) + Number(t.amount));
      });
      setCategoryExpenses(Array.from(catMap.values()).sort((a, b) => b.value - a.value));

      // Alertas de orçamento
      if (budgetsData?.length) {
        const alerts = (budgetsData as { amount: number; category_id: string; category: unknown }[])
          .map(b => {
            const cat = Array.isArray(b.category) ? b.category[0] : (b.category as { name: string; icon: string | null } | null);
            const spent = spendingByCatId.get(b.category_id) || 0;
            const pct = Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0;
            return { name: cat?.name || "Categoria", icon: (cat as { icon?: string | null })?.icon || null, pct, spent, budget: Number(b.amount) };
          })
          .sort((a, b) => b.pct - a.pct);
        setBudgetAlerts(alerts);
      } else {
        setBudgetAlerts([]);
      }

      setSpendingLimit((profileData as any)?.spending_limit ?? null);
      setRecentTransactions(recent || []);

      const rawInvoices = (invoicesData as (UpcomingInvoice & { credit_card: UpcomingInvoice["credit_card"] | UpcomingInvoice["credit_card"][] })[]) || [];
      setUpcomingInvoices(rawInvoices.map(inv => ({
        ...inv,
        credit_card: Array.isArray(inv.credit_card) ? inv.credit_card[0] : inv.credit_card,
      })) as UpcomingInvoice[]);

      setLoading(false);
    };

    fetchData();
  }, [selectedMonth, cache, refetchCounter]);

  // Monitor SWR cache for critical data changes
  useEffect(() => {
    const checkCacheChanges = () => {
      const currentState = {
        accounts: cache.get("accounts"),
        credit_cards: cache.get("credit_cards"),
        invoices: cache.get("invoices"),
      };

      // If any key changed, trigger refetch
      const hasChanges =
        lastCacheStateRef.current.accounts !== currentState.accounts ||
        lastCacheStateRef.current.credit_cards !== currentState.credit_cards ||
        lastCacheStateRef.current.invoices !== currentState.invoices;

      if (hasChanges && lastCacheStateRef.current.accounts !== undefined) {
        setRefetchCounter((prev) => prev + 1);
      }

      lastCacheStateRef.current = currentState;
    };

    // Check immediately
    checkCacheChanges();

    // Check periodically for cache changes
    const interval = setInterval(checkCacheChanges, 1000);
    return () => clearInterval(interval);
  }, [cache]);  

  const maskCurrency = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (masked: string): number =>
    parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;

  const saveSpendingLimit = async (value: number | null) => {
    setSavingLimit(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingLimit(false); return; }
    const { error } = await supabase.from("profiles").update({ spending_limit: value } as any).eq("id", user.id);
    if (error) {
      toast.error("Erro ao salvar limite", { description: error.message });
    } else {
      setSpendingLimit(value);
      toast.success(value === null ? "Limite de gastos removido" : "Limite de gastos definido!");
      setIsLimitDialogOpen(false);
    }
    setSavingLimit(false);
  };

  // Generate Insight
  const getInsight = () => {
    if (monthlyData.length < 2) return null;
    const current = monthlyData[monthlyData.length - 1]; // This month
    const previous = monthlyData[monthlyData.length - 2]; // Last month
    
    if (current && previous && current.expenses > 0 && previous.expenses > 0) {
      const diff = ((current.expenses - previous.expenses) / previous.expenses) * 100;
      const isSaving = diff < 0;
      
      if (isSaving) {
        return {
          title: "Ótimo Desempenho",
          desc: `Você gastou ${Math.abs(diff).toFixed(1)}% a menos que no mês passado. Mantenha o ritmo!`,
          color: "emerald"
        };
      } else if (diff > 10) {
        return {
          title: "Atenção aos Gastos",
          desc: `Suas despesas subiram ${diff.toFixed(1)}% em relação ao mês repassado.`,
          color: "amber"
        };
      }
    }
    
    // Fallback if no specific comparison
    if (summary.monthBalance > 0) {
      return {
        title: "Balanço Positivo",
        desc: `Você já salvou ${formatCurrency(summary.monthBalance)} neste mês! Que tal criar uma nova Meta?`,
        color: "emerald"
      };
    }
    
    return {
      title: "Resumo do Mês",
      desc: "Continue controlando suas despesas diárias para atingir suas metas.",
      color: "blue"
    };
  };

  const currentInsight = getInsight();

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const typeIcons: Record<string, React.ReactNode> = {
    income: <ArrowUpCircle className="w-4 h-4 text-emerald-500" />,
    expense: <ArrowDownCircle className="w-4 h-4 text-red-500" />,
    transfer: <ArrowLeftRight className="w-4 h-4 text-blue-500" />,
    pix: <ArrowLeftRight className="w-4 h-4 text-purple-500" />,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLimitInput(spendingLimit !== null
                ? spendingLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "");
              setIsLimitDialogOpen(true);
            }}
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">{spendingLimit !== null ? "Editar Limite" : "Definir Limite"}</span>
          </Button>
          <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Insights */}
      {currentInsight && (
        <Card className={`border-${currentInsight.color}-500/30 bg-gradient-to-r from-${currentInsight.color}-500/10 to-transparent relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <CardContent className="p-4 sm:p-6 flex items-start sm:items-center gap-4">
            <div className={`p-3 rounded-xl bg-${currentInsight.color}-500/20 text-${currentInsight.color}-500 shrink-0`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                Inteligência App <Badge variant="secondary" className="scale-75 origin-left bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">Novo</Badge>
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>{currentInsight.title}:</strong> {currentInsight.desc}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spending Limit Banner */}
      {spendingLimit !== null && (() => {
        const pct = Math.min((summary.monthExpenses / spendingLimit) * 100, 999);
        const pctDisplay = Math.min(pct, 100);
        const pctLabel = pct.toFixed(1);
        const isOver = pct >= 100;
        const isWarning = pct >= 80;
        const isAttention = pct >= 50;

        const colors = isOver
          ? { border: "border-red-500/30", bg: "from-red-500/10", icon: "bg-red-500/20 text-red-500", bar: "bg-red-500", text: "text-red-500" }
          : isWarning
          ? { border: "border-amber-500/30", bg: "from-amber-500/10", icon: "bg-amber-500/20 text-amber-500", bar: "bg-amber-500", text: "text-amber-500" }
          : isAttention
          ? { border: "border-yellow-500/30", bg: "from-yellow-500/10", icon: "bg-yellow-500/20 text-yellow-500", bar: "bg-yellow-500", text: "text-yellow-500" }
          : { border: "border-emerald-500/30", bg: "from-emerald-500/10", icon: "bg-emerald-500/20 text-emerald-500", bar: "bg-emerald-500", text: "text-emerald-500" };

        const message = isOver
          ? `Atenção! Você ultrapassou o limite mensal — gastou ${pctLabel}% do valor definido.`
          : isWarning
          ? `Cuidado: você já consumiu ${pctLabel}% do limite mensal.`
          : isAttention
          ? `Fique atento: ${pctLabel}% do limite mensal já foi utilizado.`
          : `Tudo bem! Você usou ${pctLabel}% do limite mensal.`;

        return (
          <Card className={`border ${colors.border} bg-gradient-to-r ${colors.bg} to-transparent relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-start sm:items-center gap-4">
                <div className={`p-3 rounded-xl shrink-0 ${colors.icon}`}>
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">Limite de Gastos Mensal</h3>
                  <p className={`text-sm mt-0.5 ${colors.text}`}>{message}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className={`text-2xl font-bold ${colors.text}`}>{pctLabel}%</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(summary.monthExpenses)} / {formatCurrency(spendingLimit)}</p>
                  <div className="flex gap-1 mt-0.5">
                    <button
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Editar limite"
                      onClick={() => {
                        setLimitInput(spendingLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        setIsLimitDialogOpen(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remover limite"
                      onClick={() => saveSpendingLimit(null)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={{ width: `${pctDisplay}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-emerald-500/20 bg-emerald-500/5 min-h-[140px] flex flex-col">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Bancário</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="text-xl font-bold">{formatCurrency(summary.totalAccounts)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-red-500/20 bg-red-500/5 min-h-[140px] flex flex-col">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Gasto em Cartões</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-red-500" />
              <span className="text-xl font-bold">{formatCurrency(summary.totalCreditCardSpending)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden min-h-[140px] flex flex-col">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receitas do Mês</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-500">{formatCurrency(summary.monthIncome)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden min-h-[140px] flex flex-col">
          <CardHeader className="pb-2 flex-none">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesas do Mês</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-end">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-red-500" />
              <span className="text-xl font-bold text-red-500">{formatCurrency(summary.monthExpenses)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Invoices Alert */}
      {(() => {
        const visible = upcomingInvoices.filter(inv => !dismissedInvoiceIds.has(inv.id));
        if (!visible.length) return null;
        const dismissAll = () => {
          const next = new Set([...dismissedInvoiceIds, ...visible.map(inv => inv.id)]);
          setDismissedInvoiceIds(next);
          localStorage.setItem("dismissed_upcoming_invoices", JSON.stringify([...next]));
        };
        return (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Faturas Próximas do Vencimento
                </CardTitle>
                <button
                  onClick={dismissAll}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Fechar alerta"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visible.map(invoice => {
                  const daysUntil = differenceInDays(parseISO(invoice.due_date), new Date());
                  const cardData = invoice.credit_card as { name: string; color: string | null } | undefined;
                  const isUrgent = daysUntil <= 5;
                  return (
                    <div key={invoice.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isUrgent ? "border-red-500/30 bg-red-500/5" : "border-amber-500/20 bg-background"}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                        <CreditCard className={`w-5 h-5 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{cardData?.name || "Cartão"}</p>
                        <p className="text-xs text-muted-foreground">
                          Vence em <strong className={isUrgent ? "text-red-500" : "text-amber-500"}>
                            {daysUntil} {daysUntil === 1 ? "dia" : "dias"}
                          </strong>
                        </p>
                      </div>
                      <span className="text-sm font-bold shrink-0">{formatCurrency(Number(invoice.total_amount))}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Receitas vs Despesas</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: "var(--muted-foreground)" }} 
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis 
                    tick={{ fill: "var(--muted-foreground)" }} 
                    tickFormatter={v => `R$ ${(v/1000).toFixed(0)}k`} 
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))} 
                    contentStyle={{ 
                      backgroundColor: "var(--card)", 
                      border: "1px solid var(--border)", 
                      borderRadius: "8px",
                      color: "var(--foreground)"
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Bar dataKey="income" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            )}
          </CardContent>
        </Card>

        {/* Balance Evolution Line/Area Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Evolução do Saldo</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: "var(--muted-foreground)" }} 
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis 
                    tick={{ fill: "var(--muted-foreground)" }} 
                    tickFormatter={v => `R$ ${(v/1000).toFixed(0)}k`}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))} 
                    contentStyle={{ 
                      backgroundColor: "var(--card)", 
                      border: "1px solid var(--border)", 
                      borderRadius: "8px",
                      color: "var(--foreground)"
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                  <Area type="monotone" dataKey="balance" name="Saldo" stroke="#22c55e" fill="url(#balanceGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expenses by Category */}
      <Card>
        <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
        <CardContent>
          {categoryExpenses.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={250} className="sm:max-w-[50%]">
                <PieChart>
                  <Pie data={categoryExpenses} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {categoryExpenses.map((entry, i) => <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(Number(value))} 
                    contentStyle={{ 
                      backgroundColor: "var(--card)", 
                      border: "1px solid var(--border)", 
                      borderRadius: "8px",
                      color: "var(--foreground)"
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 max-h-[250px] overflow-y-auto w-full">
                {categoryExpenses.slice(0, 8).map((cat, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </div>
                    <span className="font-medium shrink-0">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Sem despesas no período</div>
          )}
        </CardContent>
      </Card>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#534AB7]" />
              Orçamentos do Mês
            </CardTitle>
            <Link href="/orcamentos" className="text-sm text-[#534AB7] hover:text-[#433ba3] transition-colors">
              Gerenciar →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {budgetAlerts.slice(0, 5).map((b, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      {b.icon && <span className="text-base leading-none">{b.icon}</span>}
                      <span className="truncate">{b.name}</span>
                    </span>
                    <span className={`text-xs font-medium shrink-0 ${b.pct >= 100 ? "text-red-500" : b.pct >= 80 ? "text-amber-500" : "text-muted-foreground"}`}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.budget)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${b.pct >= 100 ? "bg-red-500" : b.pct >= 80 ? "bg-amber-500" : "bg-[#534AB7]"}`}
                      style={{ width: `${Math.min(b.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {budgetAlerts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{budgetAlerts.length - 5} categorias — <Link href="/orcamentos" className="text-[#534AB7] hover:underline">ver todas</Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas Transações</CardTitle>
          <Link href="/transacoes" className="text-sm text-emerald-500 hover:text-emerald-400 transition-colors">
            Ver todas →
          </Link>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação registrada</p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {typeIcons[tx.type]}
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span className={`font-semibold text-sm ${tx.type === "income" ? "text-emerald-500" : tx.type === "expense" ? "text-red-500" : "text-blue-500"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Spending Limit Dialog */}
      <Dialog open={isLimitDialogOpen} onOpenChange={setIsLimitDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-500" />
              {spendingLimit !== null ? "Editar Limite de Gastos" : "Definir Limite de Gastos"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Defina um valor máximo de gastos mensais. Apenas um limite geral é permitido por conta.
            </p>
            <div className="space-y-2">
              <Label>Valor do Limite (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={limitInput}
                  onChange={e => setLimitInput(maskCurrency(e.target.value))}
                  placeholder="0,00"
                  className="pl-9"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter" && limitInput) saveSpendingLimit(parseCurrency(limitInput));
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsLimitDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!limitInput || savingLimit}
                onClick={() => saveSpendingLimit(parseCurrency(limitInput))}
              >
                {savingLimit && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
