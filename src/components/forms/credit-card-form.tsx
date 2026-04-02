"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BANKS, ACCOUNT_COLORS } from "@/lib/utils/constants";
import type { CreditCard } from "@/types";

interface CreditCardFormProps {
  defaultValues?: Partial<CreditCard>;
  onSubmit: (data: Partial<CreditCard>) => void;
  onCancel: () => void;
}

export function CreditCardForm({ defaultValues, onSubmit, onCancel }: CreditCardFormProps) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [bank, setBank] = useState(defaultValues?.bank || "");
  const [limitAmount, setLimitAmount] = useState(defaultValues?.limit_amount || 0);
  const [closingDay, setClosingDay] = useState(defaultValues?.closing_day || 1);
  const [dueDay, setDueDay] = useState(defaultValues?.due_day || 10);
  const [color, setColor] = useState(defaultValues?.color || ACCOUNT_COLORS[1]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({ name, bank: bank || undefined, limit_amount: Number(limitAmount), closing_day: Number(closingDay), due_day: Number(dueDay), color });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do cartão *</Label>
        <Input id="name" placeholder="Ex: Nubank Platinum" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Banco</Label>
        <Select value={bank} onValueChange={(v) => v && setBank(v)}>
          <SelectTrigger><SelectValue placeholder="Selecione o banco" /></SelectTrigger>
          <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="limit">Limite (R$) *</Label>
        <Input id="limit" type="number" step="0.01" value={limitAmount} onChange={e => setLimitAmount(Number(e.target.value))} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="closing">Dia de fechamento *</Label>
          <Input id="closing" type="number" min={1} max={31} value={closingDay} onChange={e => setClosingDay(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="due">Dia de vencimento *</Label>
          <Input id="due" type="number" min={1} max={31} value={dueDay} onChange={e => setDueDay(Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Cor</Label>
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting}>
          {defaultValues ? "Salvar" : "Criar Cartão"}
        </Button>
      </div>
    </form>
  );
}
