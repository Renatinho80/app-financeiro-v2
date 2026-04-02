"use client";

import { useState } from "react";
import { useGoals } from "@/hooks/use-goals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Target, Plus, Pencil, Trash2, Calendar, Trophy } from "lucide-react";
import { ACCOUNT_COLORS } from "@/lib/utils/constants";
import type { Goal } from "@/hooks/use-goals";

const goalIcons = ["🎯", "🏖️", "🚗", "🏠", "💻", "💍", "🎓", "👶", "💰", "✈️"];

export default function MetasPage() {
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useGoals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formCurrent, setFormCurrent] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formColor, setFormColor] = useState(ACCOUNT_COLORS[0]);
  const [formIcon, setFormIcon] = useState(goalIcons[0]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormTarget("");
    setFormCurrent("");
    setFormDeadline("");
    setFormColor(ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)]);
    setFormIcon(goalIcons[0]);
    setIsDialogOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setFormName(g.name);
    setFormTarget(g.target_amount.toString());
    setFormCurrent(g.current_amount.toString());
    setFormDeadline(g.deadline || "");
    setFormColor(g.color || ACCOUNT_COLORS[0]);
    setFormIcon(g.icon || goalIcons[0]);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formName,
      target_amount: Number(formTarget),
      current_amount: Number(formCurrent) || 0,
      deadline: formDeadline || null,
      color: formColor,
      icon: formIcon
    };

    const success = editing
      ? await updateGoal(editing.id, data)
      : await createGoal(data);
      
    if (success) setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-500" /> Metas Financeiras
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe seus objetivos e sonhos com disciplina.</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nova Meta
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-medium">Nenhuma meta definida</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
              Defina objetivos claros como uma viagem, reserva de emergência ou a compra de um veículo.
            </p>
            <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Criar Primeira Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {goals.map(goal => {
            const progress = goal.target_amount > 0 
              ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
              : 0;
            const isCompleted = progress >= 100;
            
            return (
              <Card key={goal.id} className="relative overflow-hidden transition-all hover:border-emerald-500/30 group">
                {isCompleted && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-[100px] flex items-start justify-end p-2">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                  </div>
                )}
                <div className="h-2 w-full" style={{ backgroundColor: goal.color || "#10b981" }} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: (goal.color || "#10b981") + "15" }}>
                        {goal.icon || "🎯"}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        {goal.deadline && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(goal.deadline)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-muted-foreground">Poupado</p>
                        <p className="font-semibold text-lg">{formatCurrency(goal.current_amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Objetivo</p>
                        <p className="font-medium text-sm text-foreground/80">{formatCurrency(goal.target_amount)}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className={isCompleted ? "text-emerald-500" : ""}>{progress}%</span>
                        <span className="text-muted-foreground">Faltam {formatCurrency(Math.max(0, goal.target_amount - goal.current_amount))}</span>
                      </div>
                      <Progress value={progress} className="h-2" indicatorColor={goal.color || "#10b981"} />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 border-t bg-muted/20 opacity-0 group-hover:opacity-100 transition-opacity justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEdit(goal)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => setDeletingId(goal.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome do objetivo</Label>
              <Input required value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Viagem para Europa" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$)</Label>
                <Input required type="number" step="0.01" min="1" value={formTarget} onChange={e => setFormTarget(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Valor Atual Poupado</Label>
                <Input type="number" step="0.01" min="0" value={formCurrent} onChange={e => setFormCurrent(e.target.value)} placeholder="0,00" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data Alvo (Opcional)</Label>
              <Input type="date" value={formDeadline} onChange={e => setFormDeadline(e.target.value)} />
            </div>

            <div className="space-y-2 pt-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {goalIcons.map(icon => (
                  <button
                    key={icon} type="button"
                    onClick={() => setFormIcon(icon)}
                    className={`w-10 h-10 text-xl rounded-md flex items-center justify-center transition-all ${formIcon === icon ? "bg-accent border-2 border-emerald-500 scale-110 shadow-sm" : "hover:bg-accent/50"}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map(color => (
                  <button
                    key={color} type="button"
                    onClick={() => setFormColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${formColor === color ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o acompanhamento deste objetivo. Seu saldo de contas real se manterá intacto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if(deletingId) deleteGoal(deletingId); setDeletingId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
