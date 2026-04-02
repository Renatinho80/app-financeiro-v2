"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils/format";
import { differenceInDays, parseISO } from "date-fns";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types";

export function NotificationBanner() {
  const [invoices, setInvoices] = useState<(Invoice & { credit_card?: { name: string } })[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchUpcomingInvoices = async () => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const fiveDaysLater = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data } = await supabase
        .from("invoices")
        .select("*, credit_card:credit_cards(name)")
        .in("status", ["open", "closed"])
        .gte("due_date", today)
        .lte("due_date", fiveDaysLater)
        .order("due_date", { ascending: true });

      if (data && data.length > 0) {
        setInvoices(data as (Invoice & { credit_card?: { name: string } })[]);
      }
    };

    fetchUpcomingInvoices();
  }, []);

  if (dismissed || invoices.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {invoices.map((invoice) => {
              const daysUntil = differenceInDays(parseISO(invoice.due_date), new Date());
              const cardName = (invoice.credit_card as { name: string } | undefined)?.name || "Cartão";
              return (
                <span key={invoice.id} className="text-amber-600 dark:text-amber-400">
                  Fatura do <strong>{cardName}</strong> vence em{" "}
                  <strong>{daysUntil} {daysUntil === 1 ? "dia" : "dias"}</strong> — {formatCurrency(invoice.total_amount)}
                </span>
              );
            })}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
          onClick={() => setDismissed(true)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
