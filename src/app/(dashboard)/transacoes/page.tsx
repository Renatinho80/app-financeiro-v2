"use client";

import { useEffect, useState } from "react";
import { useTransactions } from "@/hooks/use-transactions";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useCategories } from "@/hooks/use-categories";
import { TransactionForm } from "@/components/forms/transaction-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate, getTransactionTypeLabel, getTransactionStatusLabel } from "@/lib/utils/format";
import { Plus, Search, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Trash2, Copy, Download } from "lucide-react";
import type { Transaction, TransactionFilters } from "@/types";

const typeColors: Record<string, string> = {
  income: "text-emerald-500",
  expense: "text-red-500",
  transfer: "text-blue-500",
  pix: "text-purple-500",
};

const typeIcons: Record<string, React.ReactNode> = {
  income: <ArrowUpCircle className="w-5 h-5 text-emerald-500" />,
  expense: <ArrowDownCircle className="w-5 h-5 text-red-500" />,
  transfer: <ArrowLeftRight className="w-5 h-5 text-blue-500" />,
  pix: <ArrowLeftRight className="w-5 h-5 text-purple-500" />,
};

export default function TransacoesPage() {
  const { transactions, loading, total, page, totalPages, pageSize, fetchTransactions, createTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { creditCards } = useCreditCards();
  const { categories, allFlat } = useCategories();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [search, setSearch] = useState("");
  const [pageInput, setPageInput] = useState("");

  useEffect(() => { fetchTransactions(filters, page); }, [fetchTransactions, filters, page]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search }));
  };

  const handlePageJump = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const targetPage = parseInt(pageInput);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
        fetchTransactions(filters, targetPage, pageSize);
      }
      setPageInput("");
    }
  };

  const handleCreateOrUpdate = async (data: Parameters<typeof createTransaction>[0]) => {
    let success = false;
    if (editingTx) {
      success = await updateTransaction(editingTx.id, data);
    } else {
      success = await createTransaction(data);
    }
    if (success) {
      setIsFormOpen(false);
      setEditingTx(null);
      fetchTransactions(filters, page);
    }
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTx) return;
    const isGroup = deletingTx.is_recurring || deletingTx.is_installment;
    await deleteTransaction(deletingTx.id);
    setDeletingTx(null);
    fetchTransactions(filters, page);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground">{total} transação(ões) encontrada(s)</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => { setEditingTx(null); setIsFormOpen(true); }}>
            <Plus className="w-4 h-4" /> Nova Transação
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                className="pl-10"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select value={filters.type || "all"} onValueChange={v => setFilters(prev => ({ ...prev, type: v === "all" ? undefined : v as TransactionFilters["type"] }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status || "all"} onValueChange={v => setFilters(prev => ({ ...prev, status: v === "all" ? undefined : v as TransactionFilters["status"] }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-full sm:w-auto"
              value={filters.startDate || ""}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value || undefined }))}
              title="Data inicial"
            />
            <Input
              type="date"
              className="w-full sm:w-auto"
              value={filters.endDate || ""}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value || undefined }))}
              title="Data final"
            />
          </div>
        </CardContent>
      </Card>

      {/* Transactions list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ArrowLeftRight className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma transação encontrada</h3>
            <p className="text-sm text-muted-foreground mb-4">Comece registrando sua primeira transação.</p>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setEditingTx(null); setIsFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Nova Transação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:shadow-sm transition-all group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {typeIcons[tx.type]}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{tx.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(tx.date)}</span>
                    {tx.category && <span>• {(tx.category as { icon?: string }).icon} {(tx.category as { name: string }).name}</span>}
                    {tx.is_installment && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tx.installment_number}/{tx.installment_total}</Badge>}
                    {tx.is_recurring && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Recorrente</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`font-semibold ${typeColors[tx.type]}`}>
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{formatCurrency(Number(tx.amount))}
                  </p>
                  <Badge variant={tx.status === "confirmed" ? "default" : "secondary"} className="text-[10px]">
                    {getTransactionStatusLabel(tx.status)}
                  </Badge>
                </div>
                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleEdit(tx)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingTx(tx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 text-sm text-muted-foreground w-full">
          <div className="flex items-center gap-2">
            <span>Itens por página</span>
            <Select 
              value={pageSize.toString()} 
              onValueChange={v => fetchTransactions(filters, 1, parseInt(v || "20"))}
            >
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <span className="shrink-0">Página {page} de {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => fetchTransactions(filters, 1, pageSize)}>
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => fetchTransactions(filters, page - 1, pageSize)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Input 
                className="w-12 h-8 text-center" 
                placeholder="Nº" 
                value={pageInput} 
                onChange={(e) => setPageInput(e.target.value)} 
                onKeyDown={handlePageJump}
                title="Pressione Enter para ir à página"
              />
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => fetchTransactions(filters, page + 1, pageSize)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => fetchTransactions(filters, totalPages, pageSize)}>
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction form dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) setEditingTx(null);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTx ? "Editar Transação" : "Nova Transação"}</DialogTitle>
          </DialogHeader>
          <TransactionForm
            accounts={accounts}
            creditCards={creditCards}
            categories={allFlat}
            initialData={editingTx}
            onSubmit={handleCreateOrUpdate}
            onCancel={() => { setIsFormOpen(false); setEditingTx(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingTx} onOpenChange={(open) => !open && setDeletingTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTx?.is_recurring || deletingTx?.is_installment
                ? "Esta transação faz parte de um grupo. Deseja excluir apenas esta ou todas?"
                : "Essa ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
