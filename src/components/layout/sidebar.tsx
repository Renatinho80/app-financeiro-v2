"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import packageInfo from "../../../package.json";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  CreditCard,
  Receipt,
  Tags,
  BarChart3,
  Settings,
  X,
  Target,
  PiggyBank,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/faturas", label: "Faturas", icon: Receipt },
  { href: "/orcamentos", label: "Orçamentos", icon: PiggyBank },
  { href: "/categorias", label: "Categorias", icon: Tags },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <Link href="/dashboard">
            <Logo size="sm" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-500 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <item.icon
                  className={cn("w-5 h-5", isActive && "text-emerald-500")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Versão mobile — visível apenas abaixo de 1024px, acima da linha */}
        <div className="lg:hidden px-4 pt-3 pb-1 text-center">
          <span className="text-[10px] text-muted-foreground/50 tracking-wide select-none">
            v{packageInfo.version}
          </span>
        </div>

        <div className="p-4 border-t border-border lg:block">
          <div className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#534AB7]/10 to-transparent">
            <p className="text-xs text-muted-foreground">
              finia v{packageInfo.version}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Suas finanças, simplificadas.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
