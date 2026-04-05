"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Logo } from "@/components/ui/logo";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { ACCOUNT_COLORS, BANKS } from "@/lib/utils/constants";
import { Landmark, CreditCard, CheckCircle2, ArrowRight, Loader2, ChevronRight } from "lucide-react";

const STORAGE_KEY = "finia_onboarding_done";

type Step = "welcome" | "account" | "card" | "done";

const STEP_LABELS: Record<Exclude<Step, "welcome" | "done">, number> = {
  account: 1,
  card: 2,
};

function StepIndicator({ current }: { current: Step }) {
  if (current === "welcome" || current === "done") return null;
  const n = STEP_LABELS[current as keyof typeof STEP_LABELS];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2].map(i => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < n ? "bg-[#534AB7] text-white" :
            i === n ? "bg-[#534AB7] text-white ring-4 ring-[#534AB7]/20" :
            "bg-muted text-muted-foreground"
          }`}>
            {i < n ? <CheckCircle2 className="w-4 h-4" /> : i}
          </div>
          {i < 2 && <div className={`h-px w-8 transition-all ${i < n ? "bg-[#534AB7]" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const { accounts, loading: accountsLoading, createAccount } = useAccounts();
  const { createCreditCard } = useCreditCards();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [submitting, setSubmitting] = useState(false);
  const [createdAccount, setCreatedAccount] = useState("");
  const [createdCard, setCreatedCard] = useState("");

  // Account form
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<"checking" | "savings" | "wallet">("checking");
  const [accBank, setAccBank] = useState("");
  const [accBalanceStr, setAccBalanceStr] = useState("");
  const [accBalanceNum, setAccBalanceNum] = useState(0);
  const [accColor, setAccColor] = useState(ACCOUNT_COLORS[0]);

  // Card form
  const [cardName, setCardName] = useState("");
  const [cardBank, setCardBank] = useState("");
  const [cardLimitStr, setCardLimitStr] = useState("");
  const [cardLimitNum, setCardLimitNum] = useState(0);
  const [cardClosingDay, setCardClosingDay] = useState("1");
  const [cardDueDay, setCardDueDay] = useState("10");
  const [cardColor, setCardColor] = useState(ACCOUNT_COLORS[2]);

  useEffect(() => {
    if (accountsLoading) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done && accounts.length === 0) setOpen(true);
  }, [accounts, accountsLoading]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setAccBalanceStr(""); setAccBalanceNum(0); return; }
    const num = Number(raw) / 100;
    setAccBalanceNum(num);
    setAccBalanceStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) { setCardLimitStr(""); setCardLimitNum(0); return; }
    const num = Number(raw) / 100;
    setCardLimitNum(num);
    setCardLimitStr(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await createAccount({ name: accName, type: accType, bank: accBank || undefined, balance: accBalanceNum, color: accColor });
    setSubmitting(false);
    if (ok) { setCreatedAccount(accName); setStep("card"); }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await createCreditCard({ name: cardName, bank: cardBank || undefined, limit_amount: cardLimitNum, closing_day: Number(cardClosingDay), due_day: Number(cardDueDay), color: cardColor, is_active: true });
    setSubmitting(false);
    if (ok) { setCreatedCard(cardName); setStep("done"); }
  };

  const accTypeLabel = accType === "checking" ? "Conta Corrente" : accType === "savings" ? "Poupança" : "Carteira";

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Welcome */}
        {step === "welcome" && (
          <div className="flex flex-col items-center text-center p-8 gap-6">
            <Logo size="md" showTagline />
            <div>
              <h2 className="text-2xl font-bold mt-2">Bem-vindo ao finia!</h2>
              <p className="text-muted-foreground text-sm mt-2 max-w-sm">
                Vamos configurar tudo em 2 passos rápidos para você começar a controlar suas finanças.
              </p>
            </div>
            <div className="w-full space-y-2 text-left">
              {[
                { icon: Landmark, text: "Adicione sua conta bancária principal" },
                { icon: CreditCard, text: "Cadastre seu cartão de crédito (opcional)" },
                { icon: CheckCircle2, text: "Pronto! Comece a registrar suas transações" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-lg bg-[#534AB7]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#534AB7]" />
                  </div>
                  <span className="text-sm">{text}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col w-full gap-2">
              <Button className="w-full bg-[#534AB7] hover:bg-[#433ba3] text-white" onClick={() => setStep("account")}>
                Começar <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                Pular configuração
              </button>
            </div>
          </div>
        )}

        {/* Account */}
        {step === "account" && (
          <div className="p-8">
            <StepIndicator current="account" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#534AB7]/10 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-[#534AB7]" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Conta Bancária</h2>
                <p className="text-xs text-muted-foreground">Qual é a sua conta principal?</p>
              </div>
            </div>
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da conta *</Label>
                <Input value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ex: Conta Nubank" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={accType} onValueChange={v => v && setAccType(v as typeof accType)}>
                    <SelectTrigger><span data-slot="select-value">{accTypeLabel}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Conta Corrente</SelectItem>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="wallet">Carteira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Select value={accBank || "none"} onValueChange={v => v && setAccBank(v === "none" ? "" : v)}>
                    <SelectTrigger><span data-slot="select-value">{accBank || "Selecione"}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Saldo atual (R$)</Label>
                <Input type="text" inputMode="numeric" value={accBalanceStr} onChange={handleBalanceChange} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setAccColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${accColor === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-[#534AB7] hover:bg-[#433ba3] text-white" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuar <ChevronRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
              <button type="button" onClick={() => setStep("card")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 text-center">
                Pular esta etapa
              </button>
            </form>
          </div>
        )}

        {/* Card */}
        {step === "card" && (
          <div className="p-8">
            <StepIndicator current="card" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#534AB7]/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-[#534AB7]" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Cartão de Crédito</h2>
                <p className="text-xs text-muted-foreground">Tem um cartão? Adicione agora (opcional)</p>
              </div>
            </div>
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do cartão *</Label>
                <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Ex: Nubank Roxinho" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Banco</Label>
                  <Select value={cardBank || "none"} onValueChange={v => v && setCardBank(v === "none" ? "" : v)}>
                    <SelectTrigger><span data-slot="select-value">{cardBank || "Selecione"}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Limite (R$)</Label>
                  <Input type="text" inputMode="numeric" value={cardLimitStr} onChange={handleLimitChange} placeholder="0,00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Dia de fechamento</Label>
                  <Input type="number" min="1" max="31" value={cardClosingDay} onChange={e => setCardClosingDay(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Dia de vencimento</Label>
                  <Input type="number" min="1" max="31" value={cardDueDay} onChange={e => setCardDueDay(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setCardColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${cardColor === c ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1 bg-[#534AB7] hover:bg-[#433ba3] text-white" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Adicionar cartão <ChevronRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
              <button type="button" onClick={() => setStep("done")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 text-center">
                Pular esta etapa
              </button>
            </form>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="flex flex-col items-center text-center p-8 gap-5">
            <div className="w-20 h-20 rounded-full bg-[#534AB7]/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#534AB7]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Tudo pronto!</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Seu finia está configurado. Comece a registrar suas transações.
              </p>
            </div>
            {(createdAccount || createdCard) && (
              <div className="w-full space-y-2 text-left">
                {createdAccount && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#534AB7]/5 border border-[#534AB7]/20">
                    <Landmark className="w-4 h-4 text-[#534AB7] shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Conta criada</p>
                      <p className="text-sm font-medium">{createdAccount}</p>
                    </div>
                  </div>
                )}
                {createdCard && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#534AB7]/5 border border-[#534AB7]/20">
                    <CreditCard className="w-4 h-4 text-[#534AB7] shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Cartão criado</p>
                      <p className="text-sm font-medium">{createdCard}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button className="w-full bg-[#534AB7] hover:bg-[#433ba3] text-white" onClick={dismiss}>
              Ir para o Dashboard <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
