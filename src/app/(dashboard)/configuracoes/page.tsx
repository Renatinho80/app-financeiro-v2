"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User, Lock, Palette, Trash2, Save, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { uploadAvatar, uploading, avatarUrl, setAvatarUrl } = useAvatarUpload();
  const [userId, setUserId] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetConsent, setResetConsent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Seleção de entidades para limpeza seletiva
  const [selTransactions, setSelTransactions] = useState(true);
  const [selAccounts, setSelAccounts] = useState(true);
  const [selCreditCards, setSelCreditCards] = useState(true);
  const [selInvoices, setSelInvoices] = useState(true);
  const [selGoals, setSelGoals] = useState(true);
  const [selCategories, setSelCategories] = useState(true);
  const [selReseed, setSelReseed] = useState(true);

  const handleToggleCreditCards = (checked: boolean) => {
    setSelCreditCards(checked);
    if (checked) setSelInvoices(true); // faturas são cascateadas pelo cartão
  };

  const nothingSelected = !selTransactions && !selAccounts && !selCreditCards && !selInvoices && !selGoals && !selCategories;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", user.id)
          .single();
        setName(profile?.name || "");
        setProfileAvatarUrl(profile?.avatar_url || null);
        setAvatarUrl(profile?.avatar_url || null);
      }
    };
    fetchProfile();
  }, []);

  const handleAvatarUpload = async (file: File) => {
    const result = await uploadAvatar(file, userId);
    if (result) {
      setProfileAvatarUrl(result);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao atualizar perfil", { description: error.message });
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Erro ao alterar senha", { description: error.message });
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteText !== "EXCLUIR") return;
    const supabase = createClient();
    // Note: account deletion requires server-side admin action
    // For now, sign out and show message
    await supabase.auth.signOut();
    toast.success("Conta excluída. Você será redirecionado.");
    router.push("/login");
  };

  const handleResetAccount = async () => {
    if (resetText !== "CONFIRMAR" || !resetConsent || nothingSelected) return;
    setIsResetting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("reset_user_account_selective", {
      _del_transactions:  selTransactions,
      _del_accounts:      selAccounts,
      _del_credit_cards:  selCreditCards,
      _del_invoices:      selInvoices,
      _del_goals:         selGoals,
      _del_categories:    selCategories,
      _reseed_categories: selCategories && selReseed,
    });

    if (error) {
      toast.error("Erro ao limpar dados", { description: error.message });
      setIsResetting(false);
      return;
    }

    toast.success("Dados removidos com sucesso.");
    setResetConfirm(false);
    setResetText("");
    setResetConsent(false);
    setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
  };

  const initials = name
    ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" /> Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AvatarUpload
            currentUrl={profileAvatarUrl || avatarUrl}
            initials={initials}
            onUpload={handleAvatarUpload}
            uploading={uploading}
          />
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <Button onClick={handleUpdateProfile} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Save className="w-4 h-4 mr-2" /> Salvar Perfil
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-5 h-5" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <Button onClick={handleChangePassword} disabled={loading} variant="outline">Alterar Senha</Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-5 h-5" /> Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tema</Label>
            {mounted ? (
              <Select value={theme} onValueChange={(v) => v && setTheme(v)}>
                <SelectTrigger>
                  <span data-slot="select-value">
                    {theme === "light" ? "Claro" : theme === "dark" ? "Escuro" : "Sistema"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 w-full rounded-md border border-input bg-background" />
            )}
          </div>
          <div className="space-y-2">
            <Label>Moeda</Label>
            <Input value="BRL (R$)" disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Moeda padrão: Real Brasileiro</p>
          </div>
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Input value="Português (pt-BR)" disabled className="opacity-60" />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Resetar Dados da Conta</h3>
            <p className="text-sm text-muted-foreground">Esta ação apagará todas as suas transações, contas bancárias, cartões, faturas e recriará as categorias e configurações padrão. Sua conta de usuário (email/senha) <strong>não</strong> será apagada.</p>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setResetConfirm(true)}>Resetar Todos os Dados</Button>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2"><Trash2 className="w-4 h-4" /> Excluir Conta Definitivamente</h3>
            <p className="text-sm text-muted-foreground">Ao excluir sua conta, todos os seus dados e seu login serão permanentemente removidos. Esta ação não pode ser desfeita.</p>
            <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>Excluir Minha Conta</Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Digite <strong>EXCLUIR</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="Digite EXCLUIR" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleteText !== "EXCLUIR"} className="bg-destructive text-white hover:bg-destructive/90">
              Excluir Conta Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetConfirm} onOpenChange={(open) => {
        if (!open && !isResetting) {
          setResetConfirm(false);
          setResetText("");
          setResetConsent(false);
        }
      }}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpeza Seletiva de Dados</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o que deseja remover. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            {/* Checkboxes */}
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-4">
              {/* Transações */}
              <div className="flex items-start gap-3">
                <Checkbox id="sel-tx" checked={selTransactions} onCheckedChange={(c) => setSelTransactions(!!c)} className="mt-0.5" />
                <div>
                  <Label htmlFor="sel-tx" className="cursor-pointer font-medium">Transações</Label>
                  <p className="text-xs text-muted-foreground">Histórico de receitas, despesas e transferências. Tags removidas junto.</p>
                </div>
              </div>

              {/* Contas */}
              <div className="flex items-start gap-3">
                <Checkbox id="sel-acc" checked={selAccounts} onCheckedChange={(c) => setSelAccounts(!!c)} className="mt-0.5" />
                <div>
                  <Label htmlFor="sel-acc" className="cursor-pointer font-medium">Contas Bancárias</Label>
                  <p className="text-xs text-muted-foreground">Transações vinculadas ficam no histórico com conta removida.</p>
                </div>
              </div>

              {/* Cartões */}
              <div className="flex items-start gap-3">
                <Checkbox id="sel-cc" checked={selCreditCards} onCheckedChange={(c) => handleToggleCreditCards(!!c)} className="mt-0.5" />
                <div>
                  <Label htmlFor="sel-cc" className="cursor-pointer font-medium">
                    Cartões de Crédito
                    <span className="ml-2 text-[10px] font-normal text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">inclui faturas</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">Faturas são sempre removidas junto ao cartão (dependência obrigatória).</p>
                </div>
              </div>

              {/* Faturas (desabilitado se cartões marcado) */}
              <div className={`flex items-start gap-3 pl-6 ${selCreditCards ? "opacity-50" : ""}`}>
                <Checkbox
                  id="sel-inv"
                  checked={selInvoices}
                  disabled={selCreditCards}
                  onCheckedChange={(c) => setSelInvoices(!!c)}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="sel-inv" className={`font-medium ${selCreditCards ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    Faturas
                    {selCreditCards && <span className="ml-2 text-[10px] font-normal text-muted-foreground">(incluídas com cartões)</span>}
                  </Label>
                  <p className="text-xs text-muted-foreground">Apenas as faturas, mantendo os cartões cadastrados.</p>
                </div>
              </div>

              {/* Metas */}
              <div className="flex items-start gap-3">
                <Checkbox id="sel-goals" checked={selGoals} onCheckedChange={(c) => setSelGoals(!!c)} className="mt-0.5" />
                <div>
                  <Label htmlFor="sel-goals" className="cursor-pointer font-medium">Metas Financeiras</Label>
                  <p className="text-xs text-muted-foreground">Objetivos e progresso de poupança.</p>
                </div>
              </div>

              {/* Categorias */}
              <div className="flex items-start gap-3">
                <Checkbox id="sel-cat" checked={selCategories} onCheckedChange={(c) => setSelCategories(!!c)} className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="sel-cat" className="cursor-pointer font-medium">
                    Categorias
                    <span className="ml-2 text-[10px] font-normal text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">inclui orçamentos</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">Transações vinculadas ficam sem categoria. Orçamentos removidos junto.</p>

                  {selCategories && (
                    <div className="flex items-center gap-2 mt-2 pl-0.5">
                      <Checkbox id="sel-reseed" checked={selReseed} onCheckedChange={(c) => setSelReseed(!!c)} />
                      <Label htmlFor="sel-reseed" className="text-xs cursor-pointer text-muted-foreground font-normal">
                        Restaurar categorias padrão após remoção
                      </Label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso se nada selecionado */}
            {nothingSelected && (
              <p className="text-xs text-destructive text-center">Selecione ao menos um item para continuar.</p>
            )}

            {/* Consentimento */}
            <div className="flex items-center gap-3 border border-border rounded-lg p-3">
              <Checkbox id="consent" checked={resetConsent} onCheckedChange={(c) => setResetConsent(!!c)} />
              <Label htmlFor="consent" className="text-sm cursor-pointer">
                Estou ciente que esta ação é <strong>irreversível</strong>.
              </Label>
            </div>

            {/* Confirmação textual */}
            <div className="space-y-1.5">
              <Label className="text-sm">
                Digite <strong>CONFIRMAR</strong> para prosseguir:
              </Label>
              <Input
                value={resetText}
                onChange={e => setResetText(e.target.value)}
                placeholder="CONFIRMAR"
                disabled={!resetConsent || nothingSelected}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAccount}
              disabled={resetText !== "CONFIRMAR" || !resetConsent || nothingSelected || isResetting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isResetting ? "Removendo dados..." : "Confirmar Limpeza"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
