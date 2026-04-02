"use client";

import { useState } from "react";
import { useCategories } from "@/hooks/use-categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCOUNT_COLORS } from "@/lib/utils/constants";
import { getCategoryTypeLabel } from "@/lib/utils/format";
import { Plus, Pencil, Trash2, Tags, ChevronRight } from "lucide-react";
import type { Category, CategoryType } from "@/types";

const defaultIcons = ["🍽️", "🛒", "🚗", "🏠", "💡", "🎮", "✈️", "🏥", "📚", "👕", "🐾", "💰", "📈", "💳", "🚌", "📱", "💼", "👶", "🎁", "🥗"];

export default function CategoriasPage() {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useCategories();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<CategoryType>("expense");
  const [formColor, setFormColor] = useState(ACCOUNT_COLORS[0]);
  const [formIcon, setFormIcon] = useState("");
  const [formParentId, setFormParentId] = useState<string | null>(null);

  const openCreate = (type: CategoryType, parentId?: string) => {
    setEditing(null);
    setFormName("");
    setFormType(type);
    setFormColor(ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)]);
    setFormIcon("");
    setFormParentId(parentId || null);
    setIsDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormColor(cat.color || ACCOUNT_COLORS[0]);
    setFormIcon(cat.icon || "");
    setFormParentId(cat.parent_id);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name: formName, type: formType, color: formColor, icon: formIcon || null, parent_id: formParentId };
    const success = editing
      ? await updateCategory(editing.id, data)
      : await createCategory(data);
    if (success) setIsDialogOpen(false);
  };

  const filterByType = (type: CategoryType) => categories.filter(c => c.type === type);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      </div>
    );
  }

  const renderCategoryList = (type: CategoryType) => {
    const cats = filterByType(type);
    if (cats.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Tags className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma categoria de {getCategoryTypeLabel(type).toLowerCase()}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreate(type)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {cats.map(cat => (
          <div key={cat.id}>
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:shadow-sm transition-shadow group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: (cat.color || "#64748b") + "15" }}>
                  {cat.icon || "📁"}
                </div>
                <span className="font-medium text-sm">{cat.name}</span>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{cat.subcategories.length} sub</Badge>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate(type, cat.id)} title="Adicionar subcategoria">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(cat.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {cat.subcategories && cat.subcategories.length > 0 && (
              <div className="ml-6 mt-1 space-y-1">
                {cat.subcategories.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-2 pl-3 rounded-lg bg-muted/50 group">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm">{sub.icon} {sub.name}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(sub)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeletingId(sub.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => openCreate("expense")}>
          <Plus className="w-4 h-4" /> Nova Categoria
        </Button>
      </div>

      <Tabs defaultValue="expense">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
          <TabsTrigger value="transfer">Transferências</TabsTrigger>
        </TabsList>
        <TabsContent value="expense" className="mt-4">{renderCategoryList("expense")}</TabsContent>
        <TabsContent value="income" className="mt-4">{renderCategoryList("income")}</TabsContent>
        <TabsContent value="transfer" className="mt-4">{renderCategoryList("transfer")}</TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Alimentação" required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as CategoryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ícone (emoji)</Label>
              <Input value={formIcon} onChange={e => setFormIcon(e.target.value)} placeholder="🍔" />
              <div className="flex gap-2 flex-wrap pt-2">
                {defaultIcons.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    title={icon}
                    onClick={() => setFormIcon(icon)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all ${formIcon === icon ? "bg-muted ring-2 ring-emerald-500 scale-110" : "hover:bg-muted hover:scale-105"}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {ACCOUNT_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setFormColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${formColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>Categorias com transações vinculadas não podem ser excluídas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deletingId) { await deleteCategory(deletingId); setDeletingId(null); } }} className="bg-destructive text-white hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
