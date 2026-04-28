"use client";

import { useState, useEffect } from "react";
import { useInvoices } from "@/hooks/use-invoices";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useAccounts } from "@/hooks/use-accounts";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, formatMonthYear } from "@/lib/utils/format";
import { Receipt, CheckCircle2, Clock, AlertCircle, ChevronDown, ChevronUp, RotateCcw, TrendingUp, XCircle } from "lucide-react";
import type { Transaction } from "@/types";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: "Aberta", color: "bg-amber-500/10 text-amber-500", icon: <Clock className="w-4 h-4" /> },
  closed: { label: "Fechada", color: "bg-orange-500/10 text-orange-500", icon: <AlertCircle className="w-4 h-4" /> },
  paid: { label: "Paga", color: "bg-emerald-500/10 text-emerald-500", icon: <CheckCircle2 className="w-4 h-4" /> },
};

export default function FaturasPage() {
  const { creditCards } = useCreditCards();
  const { accounts } = useAccounts();
  const [selectedCard, setSelectedCard] = useState<string | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const { invoices, loading, markAsPaid, reopenInvoice, closeInvoice, autoAdvanceInvoices, getReopenedIds } = useInvoices(selectedCard);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [invoiceTransactions, setInvoiceTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [reopenedIds, setReopenedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    autoAdvanceInvoices();
    setReopenedIds(getReopenedIds());
  }, []);

  const toggleExpand = async (invoiceId: string) => {
    if (expandedId === invoiceId) {
      setExpandedId(null);
      setInvoiceTransactions([]);
      return;
    }

    setExpandedId(invoiceId);
    setLoadingTxs(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select("*, category:categories(name, icon)")
      .eq("invoice_id", invoiceId)
      .order("date", { ascending: false });

    setInvoiceTransactions((data as Transaction[]) || []);
    setLoadingTxs(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturas</h1>
          <p className="text-muted-foreground">{invoices.length} fatura(s)</p>
        </div>
        <Select
          value={selectedCard || "all"}
          onValueChange={v => v && setSelectedCard(v === "all" ? undefined : v)}
          items={{ "all": "Todos os cartões", ...Object.fromEntries(creditCards.map(c => [c.id, c.name])) }}
        >
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os cartões" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhuma fatura encontrada</h3>
            <p className="text-sm text-muted-foreground">As faturas são geradas automaticamente ao adicionar transações em cartões de crédito.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map(invoice => {
            const status = statusConfig[invoice.status] || statusConfig.open;
            const cardName = (invoice.credit_card as { name: string } | undefined)?.name || "Cartão";
            const isExpanded = expandedId === invoice.id;
            return (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status.color}`}>
                        {status.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{cardName}</h3>
                        <p className="text-sm text-muted-foreground capitalize">{formatMonthYear(invoice.reference_month)}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>Fecha: {formatDate(invoice.closing_date)}</span>
                          <span>Vence: {formatDate(invoice.due_date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold">{formatCurrency(Number(invoice.total_amount))}</p>
                        <Badge className={`${status.color} border-0`}>{status.label}</Badge>
                      </div>
                      {invoice.status !== "paid" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => setPayingId(invoice.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Pagar
                        </Button>
                      )}
                      {invoice.status === "open" && reopenedIds.has(invoice.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                          onClick={() => setClosingId(invoice.id)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Fechar
                        </Button>
                      )}
                      {invoice.status !== "open" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                          onClick={() => setReopeningId(invoice.id)}
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reabrir
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => toggleExpand(invoice.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded: transaction details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Transações desta fatura
                      </h4>
                      {loadingTxs ? (
                        <div className="space-y-2">
                          {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                        </div>
                      ) : invoiceTransactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma transação vinculada a esta fatura.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {invoiceTransactions.map(tx => {
                            const cat = tx.category as { name?: string; icon?: string } | null;
                            return (
                              <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-xs text-muted-foreground w-20 shrink-0">
                                    {formatDate(tx.date)}
                                  </span>
                                  <span className="text-sm truncate">{tx.description}</span>
                                  {cat?.name && (
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {cat.icon} {cat.name}
                                    </span>
                                  )}
                                  {tx.is_installment && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                      {tx.installment_number}/{tx.installment_total}
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-semibold text-sm text-red-500 shrink-0 ml-2">
                                  {formatCurrency(Number(tx.amount))}
                                </span>
                              </div>
                            );
                          })}
                          <div className="flex justify-end pt-2 border-t border-border mt-2">
                            <span className="text-sm font-bold">
                              Total: {formatCurrency(invoiceTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!payingId} onOpenChange={(open) => {
        if (!open) {
          setPayingId(null);
          setSelectedAccountId(undefined);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar fatura como paga?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAccountId
                ? "O valor será debitado da conta selecionada."
                : "Sem conta selecionada, a fatura será marcada como paga sem movimentar saldo."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>
                Conta para Débito{" "}
                <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Select value={selectedAccountId ?? ""} onValueChange={(val) => setSelectedAccountId(val || undefined)}>
                <SelectTrigger>
                  <span data-slot="select-value">
                    {selectedAccountId
                      ? accounts.find(a => a.id === selectedAccountId)?.name
                      : "Nenhuma — registrar apenas o pagamento"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma — registrar apenas o pagamento</SelectItem>
                  {accounts.filter(a => a.is_active).map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatCurrency(acc.balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (payingId) {
                  await markAsPaid(payingId, selectedAccountId ?? null);
                  setPayingId(null);
                  setSelectedAccountId(undefined);
                }
              }}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reopeningId} onOpenChange={(open) => !open && setReopeningId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir fatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A fatura voltará ao status <strong>Aberta</strong>. Ela <strong>não será fechada automaticamente</strong> — você precisará clicar em "Fechar" manualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (reopeningId) {
                  await reopenInvoice(reopeningId);
                  setReopenedIds(getReopenedIds());
                  setReopeningId(null);
                }
              }}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!closingId} onOpenChange={(open) => !open && setClosingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar fatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A fatura será marcada como <strong>Fechada</strong>. Para pagá-la depois, use o botão "Pagar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (closingId) {
                  await closeInvoice(closingId);
                  setReopenedIds(getReopenedIds());
                  setClosingId(null);
                }
              }}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Fechar Fatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
