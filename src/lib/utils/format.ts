import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateLong(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatMonthYear(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMMM yyyy", { locale: ptBR });
}

export function formatShortMonth(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM/yy", { locale: ptBR });
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transferência",
    pix: "Pix",
  };
  return labels[type] || type;
}

export function getTransactionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
  };
  return labels[status] || status;
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    checking: "Conta Corrente",
    savings: "Poupança",
    wallet: "Carteira",
  };
  return labels[type] || type;
}

export function getInvoiceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Aberta",
    closed: "Fechada",
    paid: "Paga",
  };
  return labels[status] || status;
}

export function getCategoryTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transferência",
  };
  return labels[type] || type;
}
