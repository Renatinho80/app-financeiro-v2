"use client";

import { useState, useEffect, useMemo } from "react";
import { addDays, addWeeks, addMonths, addYears } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { Account, CreditCard, Category } from "@/types";
import type { TransactionFormData } from "@/lib/validations/transaction";

interface TransactionFormProps {
  accounts: Account[];
  creditCards: CreditCard[];
  categories: Category[];
  onSubmit: (data: TransactionFormData) => void;
  onCancel: () => void;
  initialData?: any;
}

export function TransactionForm({ accounts, creditCards, categories, onSubmit, onCancel, initialData }: TransactionFormProps) {
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "ted" | "doc" | "cash" | null>(null);
  const [amount, setAmount] = useState(0);
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [creditCardId, setCreditCardId] = useState<string | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "confirmed">("confirmed");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"daily" | "weekly" | "monthly" | "yearly" | null>(null);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentTotal, setInstallmentTotal] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  const recurringPreview = useMemo(() => {
    if (!isRecurring || !recurrenceType || !date) return null;
    const baseDate = new Date(date);
    const endDate = recurrenceEndDate ? new Date(recurrenceEndDate) : addMonths(baseDate, 3);
    let count = 0;
    let cur = new Date(baseDate);
    while (cur <= endDate && count < 500) {
      count++;
      if (recurrenceType === "daily") cur = addDays(cur, 1);
      else if (recurrenceType === "weekly") cur = addWeeks(cur, 1);
      else if (recurrenceType === "monthly") cur = addMonths(cur, 1);
      else if (recurrenceType === "yearly") cur = addYears(cur, 1);
    }
    return count;
  }, [isRecurring, recurrenceType, date, recurrenceEndDate]);

  useEffect(() => {
    if (initialData) {
      setTxType(initialData.type || "expense");
      setPaymentMethod(initialData.payment_method || null);
      setAmount(initialData.amount || 0);
      setAmountStr(initialData.amount ? Number(initialData.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
      setDescription(initialData.description || "");
      setDate(initialData.date ? initialData.date.split("T")[0] : new Date().toISOString().split("T")[0]);
      setNotes(initialData.notes || "");
      setAccountId(initialData.account_id || null);
      setCreditCardId(initialData.credit_card_id || null);
      setDestinationAccountId(initialData.destination_account_id || null);
      setCategoryId(initialData.category_id || null);
      setStatus(initialData.status || "confirmed");
      setIsRecurring(initialData.is_recurring || false);
      setRecurrenceType(initialData.recurrence_type || null);
      setRecurrenceEndDate(initialData.recurrence_end_date ? initialData.recurrence_end_date.split("T")[0] : "");
      setIsInstallment(initialData.is_installment || false);
      setInstallmentTotal(initialData.installment_total || 2);
    }
  }, [initialData]);

  const showDestination = txType === "transfer" && paymentMethod !== "cash";
  const filteredCategories = categories.filter(c => {
    if (txType === "income") return c.type === "income";
    if (txType === "transfer") return c.type === "transfer";
    return c.type === "expense";
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setAmountStr("");
      setAmount(0);
      return;
    }
    const num = Number(raw) / 100;
    setAmount(num);
    setAmountStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) return;
    setSubmitting(true);
    await onSubmit({
      type: txType, amount, description, date, notes: notes || undefined,
      account_id: accountId, credit_card_id: creditCardId,
      destination_account_id: showDestination ? destinationAccountId : null, category_id: categoryId,
      payment_method: txType === "transfer" ? paymentMethod : null,
      status, is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType : null,
      recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
      is_installment: isInstallment,
      installment_total: isInstallment ? installmentTotal : null,
    });
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo *</Label>
        <div className="grid grid-cols-3 gap-2">
          {([["expense","Despesa"], ["income","Receita"], ["transfer","Transferência"]] as const).map(([t,label]) => (
            <Button key={t} type="button" variant={txType === t ? "default" : "outline"} size="sm"
              className={txType === t ? (t === "income" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : t === "expense" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white") : ""}
              onClick={() => { setTxType(t); if (t !== "transfer") setPaymentMethod(null); }}>{label}</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Valor (R$) *</Label>
          <Input id="amount" type="text" placeholder="0,00" value={amountStr} onChange={handleAmountChange} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Data *</Label>
          <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição *</Label>
        <Input id="description" placeholder="Ex: Supermercado, Salário..." value={description} onChange={e => setDescription(e.target.value)} required />
      </div>

      {txType === "transfer" && (
        <div className="space-y-2">
          <Label>Método de Transferência</Label>
          <Select value={paymentMethod || "none"} onValueChange={v => v && setPaymentMethod(v === "none" ? null : v as typeof paymentMethod)}>
            <SelectTrigger>
              <span data-slot="select-value">
                {paymentMethod === "pix" ? "Pix" : paymentMethod === "ted" ? "TED" : paymentMethod === "doc" ? "DOC" : paymentMethod === "cash" ? "Dinheiro (Saque/Dinheiro em espécie)" : "Selecione o método"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="ted">TED</SelectItem>
              <SelectItem value="doc">DOC</SelectItem>
              <SelectItem value="cash">Dinheiro (Saque/Dinheiro em espécie)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Conta</Label>
          <Select value={accountId || "none"} onValueChange={v => v && setAccountId(v === "none" ? null : v)}>
            <SelectTrigger>
              <span data-slot="select-value">{accountId ? accounts.find(a => a.id === accountId)?.name : "Selecione"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {accounts.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {txType === "expense" && (
          <div className="space-y-2">
            <Label>Cartão de crédito</Label>
            <Select value={creditCardId || "none"} onValueChange={v => v && setCreditCardId(v === "none" ? null : v)}>
              <SelectTrigger>
                <span data-slot="select-value">{creditCardId ? creditCards.find(c => c.id === creditCardId)?.name : "Selecione"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {creditCards.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showDestination && (
        <div className="space-y-2">
          <Label>Conta destino</Label>
          <Select value={destinationAccountId || "none"} onValueChange={v => v && setDestinationAccountId(v === "none" ? null : v)}>
            <SelectTrigger>
              <span data-slot="select-value">{destinationAccountId ? accounts.find(a => a.id === destinationAccountId)?.name : "Conta destino"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {accounts.filter(a => a.is_active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={categoryId || "none"} onValueChange={v => v && setCategoryId(v === "none" ? null : v)}>
          <SelectTrigger>
            <span data-slot="select-value">
              {categoryId ? (
                (() => {
                  const c = categories.find(cat => cat.id === categoryId);
                  return c ? `${c.icon} ${c.name}` : "Selecione";
                })()
              ) : "Selecione"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem categoria</SelectItem>
            {filteredCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={v => v && setStatus(v as "pending" | "confirmed")}>
          <SelectTrigger>
            <span data-slot="select-value">{status === "confirmed" ? "Confirmado" : "Pendente"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label htmlFor="recurring">Recorrente</Label>
        <Switch id="recurring" checked={isRecurring} onCheckedChange={v => { setIsRecurring(v); if (v) setIsInstallment(false); }} />
      </div>
      {isRecurring && (
        <>
          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-emerald-500/20">
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={recurrenceType || ""} onValueChange={v => v && setRecurrenceType(v as "daily" | "weekly" | "monthly" | "yearly")}>
                <SelectTrigger>
                  <span data-slot="select-value">
                    {recurrenceType === "daily" ? "Diário" : recurrenceType === "weekly" ? "Semanal" : recurrenceType === "monthly" ? "Mensal" : recurrenceType === "yearly" ? "Anual" : "Selecione"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input type="date" value={recurrenceEndDate} onChange={e => setRecurrenceEndDate(e.target.value)} />
            </div>
          </div>
          {recurringPreview !== null && (
            <p className="text-xs text-muted-foreground pl-4">
              {recurringPreview} transação{recurringPreview !== 1 ? "ões" : ""} serão criadas
              {!recurrenceEndDate && " (padrão: 3 meses)"}
              {creditCardId && " · faturas geradas apenas para o mês atual e o próximo"}
            </p>
          )}
        </>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="installment">Parcelado</Label>
        <Switch id="installment" checked={isInstallment} onCheckedChange={v => { setIsInstallment(v); if (v) setIsRecurring(false); }} />
      </div>
      {isInstallment && (
        <div className="pl-4 border-l-2 border-purple-500/20">
          <div className="space-y-2">
            <Label>Número de parcelas</Label>
            <Input type="number" min={2} max={48} value={installmentTotal} onChange={e => setInstallmentTotal(Number(e.target.value))} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" placeholder="Observações opcionais..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting}>
          {initialData ? "Salvar Alterações" : "Criar Transação"}
        </Button>
      </div>
    </form>
  );
}
