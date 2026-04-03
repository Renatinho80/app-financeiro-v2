"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatShortMonth } from "@/lib/utils/format";
import { CHART_COLORS } from "@/lib/utils/constants";
import { TrendingUp, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, CreditCard, AlertTriangle, Sparkles } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [summary, setSummary] = useState({ totalBalance: 0, totalAccounts: 0, totalInvoicesDebt: 0, monthIncome: 0, monthExpenses: 0, monthBalance: 0 });
  const [categoryExpenses, setCategoryExpenses] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number; balance: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<{ id: string; description: string; amount: number; type: string; date: string }[]>([]);
  const [upcomingInvoices, setUpcomingInvoices] = useState<UpcomingInvoice[]>([]);

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
      ] = await Promise.all([
        // 1. Saldo das contas ativas
        supabase.from("accounts").select("balance").eq("user_id", user.id).eq("is_active", true),

        // 2. Todas receitas+despesas dos últimos 6 meses (cobre gráfico + resumo do mês)
        supabase.from("transactions").select("amount, type, date")
          .eq("user_id", user.id).eq("status", "confirmed")
          .in("type", ["income", "expense"])
          .gte("date", rangeStart).lte("date", end),

        // 3. Dívida total em faturas abertas/fechadas
        supabase.from("invoices").select("total_amount").eq("user_id", user.id).in("status", ["open", "closed"]),

        // 4. Despesas por categoria (mês selecionado, com join)
        supabase.from("transactions").select("amount, category:categories(name, color)")
          .eq("user_id", user.id).eq("type", "expense").eq("status", "confirmed")
          .gte("date", start).lte("date", end),

        // 5. Últimas transações
        supabase.from("transactions").select("id, description, amount, type, date")
          .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(10),

        // 6. Faturas próximas do vencimento (15 dias)
        supabase.from("invoices")
          .select("id, total_amount, due_date, status, credit_card:credit_cards(name, color)")
          .in("status", ["open", "closed"])
          .gte("due_date", today).lte("due_date", fifteenDays)
          .order("due_date", { ascending: true }),
      ]);

      // Saldo bancário
      const totalAccounts = (accounts || []).reduce((sum: number, a: { balance: number }) => sum + Number(a.balance), 0);
      const totalInvoicesDebt = (invoices || []).reduce((sum: number, i: { total_amount: number }) => sum + Number(i.total_amount), 0);

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

      // Despesas por categoria
      const catMap = new Map<string, { name: string; value: number; color: string }>();
      (catExp || []).forEach((t) => {
        const cat = Array.isArray(t.category) ? t.category[0] : (t.category as { name: string; color: string | null } | null);
        const name = cat?.name || "Sem categoria";
        const color = cat?.color || "#64748b";
        const existing = catMap.get(name);
        if (existing) existing.value += Number(t.amount);
        else catMap.set(name, { name, value: Number(t.amount), color });
      });
      setCategoryExpenses(Array.from(catMap.values()).sort((a, b) => b.value - a.value));

      setRecentTransactions(recent || []);

      const rawInvoices = (invoicesData as (UpcomingInvoice & { credit_card: UpcomingInvoice["credit_card"] | UpcomingInvoice["credit_card"][] })[]) || [];
      setUpcomingInvoices(rawInvoices.map(inv => ({
        ...inv,
        credit_card: Array.isArray(inv.credit_card) ? inv.credit_card[0] : inv.credit_card,
      })) as UpcomingInvoice[]);

      setLoading(false);
    };

    fetchData();
  }, [selectedMonth]);  

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
        <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="relative overflow-hidden border-emerald-500/20 bg-emerald-500/5">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Bancário</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span className="text-xl font-bold">{formatCurrency(summary.totalAccounts)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-red-500/20 bg-red-500/5">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dívida em Cartão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-red-500" />
              <span className="text-xl font-bold">{formatCurrency(summary.totalInvoicesDebt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-primary/20 bg-primary/5 col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Saldo Total (Líquido)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-md ${summary.totalBalance >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                <TrendingUp className={`w-4 h-4 ${summary.totalBalance >= 0 ? "text-emerald-500" : "text-red-500"}`} />
              </div>
              <span className={`text-xl font-bold ${summary.totalBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatCurrency(summary.totalBalance)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">* Bancos - Dívidas de Cartão</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receitas do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-500">{formatCurrency(summary.monthIncome)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Despesas do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-4 h-4 text-red-500" />
              <span className="text-xl font-bold text-red-500">{formatCurrency(summary.monthExpenses)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Invoices Alert */}
      {upcomingInvoices.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Faturas Próximas do Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingInvoices.map(invoice => {
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
      )}

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
    </div>
  );
}
