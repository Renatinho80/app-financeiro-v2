"use client";

import { useState, useEffect, useMemo } from "react";
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { useBudgets } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/format";
import { PiggyBank, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Copy, AlertTriangle, TrendingUp } from "lucide-react";
import type { Budget } from "@/types";

type BudgetItem = Budget & { spent: number; pct: number };

function getProgressColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-[#534AB7]";
}

function getCardClass(pct: number) {
  if (pct >= 100) return "border-red-500/30 bg-red-500/5";
  if (pct >= 80) return "border-amber-500/30 bg-amber-500/5";
  return "hover:border-[#534AB7]/30";
}

function getStatusLabel(pct: number) {
  if (pct >= 100) return { text: "Excedido", className: "text-red-500 font-semibold" };
  if (pct >= 80) return { text: "Atenção", className: "text-amber-500 font-semibold" };
  return { text: "OK", className: "text-emerald-500 font-semibold" };
}

export default function OrcamentosPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [spendingMap, setSpendingMap] = useState<Record<string, number>>({});
  const [loadingSpending, setLoadingSpending] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmountStr, setFormAmountStr] = useState("");
  const [formAmountNum, setFormAmountNum] = useState(0);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setFormAmountStr(""); setFormAmountNum(0); return; }
    const num = Number(raw) / 100;
    setFormAmountNum(num);
    setFormAmountStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  };
  const [copying, setCopying] = useState(false);

  const { budgets, loading, createBudget, updateBudget, deleteBudget, copyFromPreviousMonth } = useBudgets(selectedMonth);
  const { allFlat } = useCategories();

  // Fetch spending for selected month
  useEffect(() => {
    let cancelled = false;
    const fetchSpending = async () => {
      setLoadingSpending(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [year, monthNum] = selectedMonth.split("-").map(Number);
      const start = format(startOfMonth(new Date(year, monthNum - 1)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(year, monthNum - 1)), "yyyy-MM-dd");

      const { data } = await supabase
        .from("transactions")
        .select("category_id, amount")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .eq("status", "confirmed")
        .gte("date", start)
        .lte("date", end);

      if (!cancelled) {
        const map: Record<string, number> = {};
        (data || []).forEach(t => {
          if (t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount);
        });
        setSpendingMap(map);
        setLoadingSpending(false);
      }
    };
    fetchSpending();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  // Month navigation
  const [year, monthNum] = selectedMonth.split("-").map(Number);
  const currentDate = new Date(year, monthNum - 1);
  const monthLabel = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  const isCurrentMonth = selectedMonth === format(new Date(), "yyyy-MM");

  const prevMonth = () => setSelectedMonth(format(subMonths(currentDate, 1), "yyyy-MM"));
  const nextMonth = () => setSelectedMonth(format(addMonths(currentDate, 1), "yyyy-MM"));

  // Budget items with spending — sorted by % descending
  const budgetItems = useMemo<BudgetItem[]>(() => {
    return budgets.map(b => {
      const spent = spendingMap[b.category_id] || 0;
      const pct = b.amount > 0 ? (spent / Number(b.amount)) * 100 : 0;
      return { ...b, spent, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [budgets, spendingMap]);

  // Summary
  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgetItems.reduce((s, b) => s + b.spent, 0);
  const overCount = budgetItems.filter(b => b.pct >= 100).length;
  const warningCount = budgetItems.filter(b => b.pct >= 80 && b.pct < 100).length;

  // Categories available for new budgets
  const expenseCategories = allFlat.filter(c => c.type === "expense");
  const availableCategories = expenseCategories.filter(c =>
    !budgets.some(b => b.category_id === c.id) || (editing?.category_id === c.id)
  );

  const openCreate = () => {
    setEditing(null);
    setFormCategoryId("");
    setFormAmountStr("");
    setFormAmountNum(0);
    setIsDialogOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditing(budget);
    setFormCategoryId(budget.category_id);
    const num = Number(budget.amount);
    setFormAmountNum(num);
    setFormAmountStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmountNum || formAmountNum <= 0 || !formCategoryId) return;

    const ok = editing
      ? await updateBudget(editing.id, formAmountNum)
      : await createBudget(formCategoryId, formAmountNum);

    if (ok) setIsDialogOpen(false);
  };

  const handleCopy = async () => {
    setCopying(true);
    await copyFromPreviousMonth();
    setCopying(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-[#534AB7]" />
            Orçamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={copying}>
            <Copy className="w-4 h-4 mr-1" />
            {copying ? "Copiando..." : "Copiar mês anterior"}
          </Button>
          <Button size="sm" className="bg-[#534AB7] hover:bg-[#433ba3] text-white gap-1"
            onClick={openCreate} disabled={availableCategories.length === 0}>
            <Plus className="w-4 h-4" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[160px] text-center">{monthLabel}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth} disabled={isCurrentMonth}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary cards */}
      {budgetItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-[#534AB7]/20 bg-[#534AB7]/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Orçado</p>
              <p className="text-2xl font-bold">{formatCurrency(totalBudget)}</p>
            </CardContent>
          </Card>
          <Card className={totalSpent > totalBudget ? "border-red-500/20 bg-red-500/5" : ""}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Gasto</p>
              <p className={`text-2xl font-bold ${totalSpent > totalBudget ? "text-red-500" : ""}`}>
                {formatCurrency(totalSpent)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(0) : 0}% do orçamento total
              </p>
            </CardContent>
          </Card>
          <Card className={overCount > 0 ? "border-red-500/20 bg-red-500/5" : warningCount > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Situação</p>
              {overCount > 0 ? (
                <p className="text-2xl font-bold text-red-500">{overCount} excedido{overCount > 1 ? "s" : ""}</p>
              ) : warningCount > 0 ? (
                <p className="text-2xl font-bold text-amber-500">{warningCount} em atenção</p>
              ) : (
                <p className="text-2xl font-bold text-emerald-500">Tudo OK</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {budgetItems.length} categoria{budgetItems.length !== 1 ? "s" : ""} monitorada{budgetItems.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {budgetItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#534AB7]/10 flex items-center justify-center">
              <PiggyBank className="w-8 h-8 text-[#534AB7]" />
            </div>
            <div>
              <p className="font-semibold text-lg">Nenhum orçamento definido</p>
              <p className="text-muted-foreground text-sm mt-1">
                Defina limites mensais por categoria para controlar seus gastos.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy} disabled={copying}>
                <Copy className="w-4 h-4 mr-1" />
                Copiar mês anterior
              </Button>
              <Button className="bg-[#534AB7] hover:bg-[#433ba3] text-white" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" />
                Criar primeiro orçamento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgetItems.map(item => {
            const cat = item.category as { name: string; color: string | null; icon: string | null } | undefined;
            const status = getStatusLabel(item.pct);
            const remaining = Number(item.amount) - item.spent;

            return (
              <Card key={item.id} className={`relative transition-all group ${getCardClass(item.pct)}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base"
                        style={{ backgroundColor: `${cat?.color || "#534AB7"}20` }}>
                        {cat?.icon || "📦"}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">{cat?.name || "Categoria"}</CardTitle>
                        <span className={`text-xs ${status.className}`}>{status.text}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingId(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Amounts */}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gasto</span>
                    <span className={`font-medium ${item.pct >= 100 ? "text-red-500" : item.pct >= 80 ? "text-amber-500" : ""}`}>
                      {formatCurrency(item.spent)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressColor(item.pct)}`}
                        style={{ width: `${Math.min(item.pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.pct.toFixed(0)}%</span>
                      <span>Limite: {formatCurrency(Number(item.amount))}</span>
                    </div>
                  </div>

                  {/* Remaining */}
                  {remaining >= 0 ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="text-emerald-500 font-medium">{formatCurrency(remaining)}</span> restantes
                    </p>
                  ) : (
                    <p className="text-xs flex items-center gap-1 text-red-500 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {formatCurrency(Math.abs(remaining))} acima do limite
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add more card */}
          {availableCategories.length > 0 && (
            <Card className="border-dashed cursor-pointer hover:border-[#534AB7]/50 hover:bg-[#534AB7]/5 transition-all"
              onClick={openCreate}>
              <CardContent className="h-full min-h-[160px] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-[#534AB7] transition-colors">
                <Plus className="w-8 h-8" />
                <span className="text-sm font-medium">Adicionar categoria</span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select
                value={formCategoryId}
                onValueChange={setFormCategoryId}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <span data-slot="select-value">
                    {formCategoryId
                      ? (() => { const c = expenseCategories.find(x => x.id === formCategoryId); return c ? `${c.icon ?? ""} ${c.name}`.trim() : "Selecione uma categoria..."; })()
                      : "Selecione uma categoria..."}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {(editing
                    ? expenseCategories.filter(c => c.id === editing.category_id)
                    : availableCategories
                  ).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Limite mensal (R$)</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={formAmountStr}
                onChange={handleAmountChange}
                placeholder="0,00"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-[#534AB7] hover:bg-[#433ba3] text-white">
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O limite desta categoria será removido. As transações não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (deletingId) { await deleteBudget(deletingId); setDeletingId(null); }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
