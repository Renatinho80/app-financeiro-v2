"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BANKS, ACCOUNT_COLORS } from "@/lib/utils/constants";
import type { Account } from "@/types";

interface AccountFormProps {
  defaultValues?: Partial<Account>;
  onSubmit: (data: Partial<Account>) => void;
  onCancel: () => void;
}

export function AccountForm({ defaultValues, onSubmit, onCancel }: AccountFormProps) {
  const [name, setName] = useState(defaultValues?.name || "");
  const [type, setType] = useState(defaultValues?.type || "checking");
  const [bank, setBank] = useState(defaultValues?.bank || "");
  const [balance, setBalance] = useState(defaultValues?.balance || 0);
  const [balanceStr, setBalanceStr] = useState(defaultValues?.balance ? defaultValues.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const [color, setColor] = useState(defaultValues?.color || ACCOUNT_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setBalanceStr("");
      setBalance(0);
      return;
    }
    const num = Number(raw) / 100;
    setBalance(num);
    setBalanceStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await onSubmit({ name, type, bank: bank || undefined, balance, color });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome da conta *</Label>
        <Input id="name" placeholder="Ex: Nubank Corrente" value={name} onChange={e => setName(e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Tipo *</Label>
        <Select value={type} onValueChange={(v) => v && setType(v as "checking" | "savings" | "wallet")}>
          <SelectTrigger>
            <span data-slot="select-value">
              {type === "checking" ? "Conta Corrente" : type === "savings" ? "Poupança" : type === "wallet" ? "Carteira" : "Selecione o tipo"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Conta Corrente</SelectItem>
            <SelectItem value="savings">Poupança</SelectItem>
            <SelectItem value="wallet">Carteira</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Banco</Label>
        <Select value={bank} onValueChange={(v) => v && setBank(v)}>
          <SelectTrigger>
            <span data-slot="select-value">{bank || "Selecione o banco"}</span>
          </SelectTrigger>
          <SelectContent>
            {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="balance">Saldo inicial (R$)</Label>
        <Input id="balance" type="text" placeholder="0,00" value={balanceStr} onChange={handleBalanceChange} />
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
          {defaultValues ? "Salvar" : "Criar Conta"}
        </Button>
      </div>
    </form>
  );
}
