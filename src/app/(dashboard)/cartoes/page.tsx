"use client";

import { useState } from "react";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { CreditCardForm } from "@/components/forms/credit-card-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils/format";
import { Plus, Pencil, Trash2, CreditCard as CreditCardIcon } from "lucide-react";
import type { CreditCard } from "@/types";

export default function CartoesPage() {
  const { creditCards, loading, createCreditCard, updateCreditCard, deleteCreditCard, getAvailableLimit } = useCreditCards();
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (data: Partial<CreditCard>) => {
    const success = editing
      ? await updateCreditCard(editing.id, data)
      : await createCreditCard(data);
    if (success) {
      setIsDialogOpen(false);
      setEditing(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-muted-foreground">{creditCards.length} cartão(ões) cadastrado(s)</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditing(null); }}>
          <DialogTrigger render={<Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" />}>
            <Plus className="w-4 h-4" /> Novo Cartão
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
            </DialogHeader>
            <CreditCardForm
              key={editing?.id || "new"}
              defaultValues={editing || undefined}
              onSubmit={handleSubmit}
              onCancel={() => { setIsDialogOpen(false); setEditing(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {creditCards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCardIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">Nenhum cartão cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">Adicione seu primeiro cartão de crédito.</p>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar Cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {creditCards.map(card => (
            <Card key={card.id} className="group relative overflow-hidden hover:shadow-lg hover:shadow-purple-500/5 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br opacity-5 pointer-events-none" style={{ background: `linear-gradient(135deg, ${card.color || "#8b5cf6"}22, transparent)` }} />
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: card.color || "#8b5cf6" }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (card.color || "#8b5cf6") + "15" }}>
                      <CreditCardIcon className="w-5 h-5" style={{ color: card.color || "#8b5cf6" }} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{card.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{card.bank || "Cartão de crédito"}</p>
                    </div>
                  </div>
                  <Badge variant={card.is_active ? "default" : "secondary"} className="text-xs">
                    {card.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const limit = Number(card.limit_amount);
                  const available = getAvailableLimit(card.id, limit);
                  const used = limit - available;
                  const usagePercent = limit > 0 ? (used / limit) * 100 : 0;
                  const availableColor = usagePercent > 80 ? "text-red-500" : usagePercent > 50 ? "text-amber-500" : "text-emerald-500";
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Limite</p>
                          <p className="font-semibold">{formatCurrency(limit)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Disponível</p>
                          <p className={`font-semibold ${availableColor}`}>{formatCurrency(available)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Fechamento</p>
                          <p className="font-medium">Dia {card.closing_day}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Vencimento</p>
                          <p className="font-medium">Dia {card.due_day}</p>
                        </div>
                      </div>
                      {/* Usage bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Utilizado</span>
                          <span>{usagePercent.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div className="flex gap-1 justify-end opacity-40 hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(card); setIsDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(card.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cartão?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. Todas as faturas e transações vinculadas serão excluídas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deletingId) { await deleteCreditCard(deletingId); setDeletingId(null); } }} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
