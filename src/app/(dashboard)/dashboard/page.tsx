"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatShortMonth, formatMonthYear } from "@/lib/utils/format";
import { CHART_COLORS } from "@/lib/utils/constants";
import { TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, CreditCard, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from "recharts";
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
  const [summary, setSummary] = useState({ totalBalance: 0, monthIncome: 0, monthExpenses: 0, monthBalance: 0 });
  const [categoryExpenses, setCategoryExpenses] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number; balance: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<{ id: string; description: string; amount: number; type: string; date: string }[]>([]);
  const [upcomingInvoices, setUpcomingInvoices] = useState<UpcomingInvoice[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();
      const [year, month] = selectedMonth.split("-").map(Number);
      const start = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

      // Total balance
      const { data: accounts } = await supabase.from("accounts").select("balance").eq("is_active", true);
      const totalBalance = (accounts || []).reduce((sum: number, a: { balance: number }) => sum + Number(a.balance), 0);

      // Month income
      const { data: incomeData } = await supabase
        .from("transactions").select("amount")
        .eq("type", "income").eq("status", "confirmed")
        .gte("date", start).lte("date", end);
      const monthIncome = (incomeData || []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

      // Month expenses
      const { data: expenseData } = await supabase
        .from("transactions").select("amount")
        .eq("type", "expense").eq("status", "confirmed")
        .gte("date", start).lte("date", end);
      const monthExpenses = (expenseData || []).reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

      setSummary({ totalBalance, monthIncome, monthExpenses, monthBalance: monthIncome - monthExpenses });

      // Expenses by category
      const { data: catExp } = await supabase
        .from("transactions")
        .select("amount, category:categories(name, color)")
        .eq("type", "expense").eq("status", "confirmed")
        .gte("date", start).lte("date", end);

      const catMap = new Map<string, { name: string; value: number; color: string }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (catExp || []).forEach((t: any) => {
        const cat = Array.isArray(t.category) ? t.category[0] : t.category;
        const name = cat?.name || "Sem categoria";
        const color = cat?.color || "#64748b";
        const existing = catMap.get(name);
        if (existing) {
          existing.value += Number(t.amount);
        } else {
          catMap.set(name, { name, value: Number(t.amount), color });
        }
      });
      setCategoryExpenses(Array.from(catMap.values()).sort((a, b) => b.value - a.value));

      // Monthly comparison (last 6 months) with cumulative balance
      const months = [];
      let cumulativeBalance = 0;
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(year, month - 1), i);
        const mStart = format(startOfMonth(d), "yyyy-MM-dd");
        const mEnd = format(endOfMonth(d), "yyyy-MM-dd");

        const { data: mIncome } = await supabase
          .from("transactions").select("amount")
          .eq("type", "income").eq("status", "confirmed")
          .gte("date", mStart).lte("date", mEnd);

        const { data: mExpense } = await supabase
          .from("transactions").select("amount")
          .eq("type", "expense").eq("status", "confirmed")
          .gte("date", mStart).lte("date", mEnd);

        const inc = (mIncome || []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
        const exp = (mExpense || []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0);
        cumulativeBalance += inc - exp;

        months.push({
          month: formatShortMonth(d),
          income: inc,
          expenses: exp,
          balance: cumulativeBalance,
        });
      }
      setMonthlyData(months);

      // Recent transactions
      const { data: recent } = await supabase
        .from("transactions")
        .select("id, description, amount, type, date")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentTransactions(recent || []);

      // Upcoming invoices (due in next 15 days, not paid)
      const today = new Date().toISOString().split("T")[0];
      const fifteenDays = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("id, total_amount, due_date, status, credit_card:credit_cards(name, color)")
        .in("status", ["open", "closed"])
        .gte("due_date", today)
        .lte("due_date", fifteenDays)
        .order("due_date", { ascending: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawInvoices = (invoicesData as any[]) || [];
      setUpcomingInvoices(rawInvoices.map(inv => ({
        ...inv,
        credit_card: Array.isArray(inv.credit_card) ? inv.credit_card[0] : inv.credit_card,
      })) as UpcomingInvoice[]);

      setLoading(false);
    };

    fetchData();
  }, [selectedMonth]);

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" />
              <span className="text-2xl font-bold">{formatCurrency(summary.totalBalance)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Receitas do Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-500">{formatCurrency(summary.monthIncome)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Despesas do Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-500">{formatCurrency(summary.monthExpenses)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo do Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${summary.monthBalance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatCurrency(summary.monthBalance)}
              </span>
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
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
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
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
