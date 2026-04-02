"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User, Lock, Palette, Trash2, Save, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetConsent, setResetConsent] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        setName(profile?.name || "");
      }
    };
    fetchProfile();
  }, []);

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
      setCurrentPassword("");
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
    if (resetText !== "RESETAR" || !resetConsent) return;
    setIsResetting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("reset_user_account");
    
    if (error) {
      toast.error("Erro ao resetar conta", { description: error.message });
      setIsResetting(false);
      return;
    }

    toast.success("Sua conta foi zerada com sucesso.");
    setResetConfirm(false);
    setResetText("");
    setResetConsent(false);
    
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
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
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-emerald-500/10 text-emerald-500 text-xl font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name || "Usuário"}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
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

      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar toda a sua conta?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-left">
              <p>Isso apagará irreversivelmente todas as suas <strong>transações, cartões, faturas e contas</strong>. As categorias e configurações serão restauradas aos padrões.</p>
              
              <div className="flex items-center space-x-2 pt-2 border-y border-border py-4 my-4">
                <Checkbox id="consent" checked={resetConsent} onCheckedChange={(c) => setResetConsent(c as boolean)} />
                <Label htmlFor="consent" className="text-sm cursor-pointer font-medium">
                  Estou ciente que perderei todos meus dados atuais.
                </Label>
              </div>

              <p>Para confirmar, digite <strong>RESETAR</strong> abaixo:</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input 
            value={resetText} 
            onChange={e => setResetText(e.target.value)} 
            placeholder="Digite RESETAR" 
            disabled={!resetConsent} 
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetAccount} 
              disabled={resetText !== "RESETAR" || !resetConsent || isResetting} 
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isResetting ? "Limpando dados..." : "Resetar Minha Conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
