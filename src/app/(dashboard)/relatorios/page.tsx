"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { FileDown, FileSpreadsheet, Upload, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useCallback } from "react";
import type { Transaction } from "@/types";
import type { jsPDF } from "jspdf";

interface jsPDFExtended extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("*, category:categories(name, icon)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar relatório");
    } else {
      setTransactions((data as Transaction[]) || []);
    }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  // Category summary
  const catSummary = new Map<string, { name: string; total: number }>();
  transactions.filter(t => t.type === "expense").forEach(t => {
    const catName = (t.category as { name: string } | null)?.name || "Sem categoria";
    const existing = catSummary.get(catName);
    if (existing) existing.total += Number(t.amount);
    else catSummary.set(catName, { name: catName, total: Number(t.amount) });
  });
  const categoryList = Array.from(catSummary.values()).sort((a, b) => b.total - a.total);

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF() as jsPDFExtended;
    
    // Header
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("FinanceApp PRO", 14, 20);
    doc.setFontSize(12);
    doc.text("Relatório Financeiro Mensal", 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Período: ${formatDate(startDate)} a ${formatDate(endDate)}`, 140, 20);
    doc.text(`Gerado em: ${formatDate(new Date().toISOString())}`, 140, 28);

    doc.setTextColor(0, 0, 0);

    // Summary
    doc.setFontSize(14);
    doc.text("Resumo", 14, 50);
    autoTable(doc, {
      startY: 55,
      head: [["Receitas", "Despesas", "Saldo Final"]],
      body: [[
        formatCurrency(totalIncome),
        formatCurrency(totalExpenses),
        formatCurrency(totalIncome - totalExpenses)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], halign: 'center' },
      bodyStyles: { halign: 'center', fontStyle: 'bold', fontSize: 12 },
    });

    let finalY = doc.lastAutoTable?.finalY || 55;

    // Category Summary
    if (categoryList.length > 0) {
      doc.setFontSize(14);
      doc.text("Gastos por Categoria", 14, finalY + 15);
      autoTable(doc, {
        startY: finalY + 20,
        head: [["Categoria", "Total", "% das Despesas"]],
        body: categoryList.map(c => [
          c.name, 
          formatCurrency(c.total), 
          totalExpenses > 0 ? ((c.total / totalExpenses) * 100).toFixed(1) + "%" : "0%"
        ]),
        headStyles: { fillColor: [239, 68, 68] },
      });
      finalY = doc.lastAutoTable?.finalY || finalY + 20;
    }

    // Transactions Table
    doc.setFontSize(14);
    doc.text("Extrato Detalhado", 14, finalY + 15);
    autoTable(doc, {
      startY: finalY + 20,
      head: [["Data", "Descrição", "Tipo", "Categoria", "Valor"]],
      body: transactions.map(t => [
        formatDate(t.date),
        t.description,
        t.type === "income" ? "Receita" : t.type === "expense" ? "Despesa" : "Transferência",
        (t.category as { name: string } | null)?.name || "-",
        formatCurrency(Number(t.amount)),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - FinanceApp PRO v1.1.0`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`financeapp-relatorio-${startDate}-${endDate}.pdf`);
    toast.success("Relatório PRO PDF gerado!");
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const data = transactions.map(t => ({
      Data: formatDate(t.date),
      Descrição: t.description,
      Tipo: t.type === "income" ? "Receita" : t.type === "expense" ? "Despesa" : "Transferência",
      Categoria: (t.category as { name: string } | null)?.name || "",
      Valor: Number(t.amount),
      Status: t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transações");
    XLSX.writeFile(wb, `relatorio-${startDate}-${endDate}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map(l => l.split(",").map(c => c.trim()));
      setCsvPreview(lines.slice(0, 6));
    };
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (!csvFile) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map(l => l.split(",").map(c => c.trim()));
      const headers = lines[0];
      const rows = lines.slice(1).filter(r => r.length >= 3);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let success = 0;
      let errors = 0;

      for (const row of rows) {
        const tx = {
          user_id: user.id,
          description: row[0] || "Importado",
          amount: parseFloat(row[1]) || 0,
          date: row[2] || new Date().toISOString().split("T")[0],
          type: (row[3] || "expense").toLowerCase(),
          status: "confirmed" as const,
        };

        const { error } = await supabase.from("transactions").insert(tx);
        if (error) errors++;
        else success++;
      }

      toast.success(`Importação concluída: ${success} sucesso, ${errors} erro(s)`);
      setIsImportOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      fetchReport();
    };
    reader.readAsText(csvFile);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}><Upload className="w-4 h-4 mr-1" /> Importar CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label>Data inicial</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Data final</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Button onClick={fetchReport} className="bg-emerald-600 hover:bg-emerald-700 text-white">Filtrar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Receitas</p>
            <p className="text-xl font-bold text-emerald-500">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Despesas</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Saldo</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {formatCurrency(totalIncome - totalExpenses)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="extract">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="extract">Extrato</TabsTrigger>
          <TabsTrigger value="categories">Por Categoria</TabsTrigger>
        </TabsList>

        <TabsContent value="extract" className="mt-4">
          {loading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : transactions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma transação no período selecionado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-20">{formatDate(tx.date)}</span>
                    <span>{tx.description}</span>
                  </div>
                  <span className={tx.type === "income" ? "text-emerald-500" : "text-red-500"}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="space-y-2">
            {categoryList.map((cat, i) => {
              const percentage = totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : "0";
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-medium">{cat.name}</span>
                    <div className="flex-1 mx-4">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{formatCurrency(cat.total)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* CSV Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importar CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-emerald-500/10 border-emerald-500/20">
              <div className="text-sm">
                <p className="font-medium">Precisa do modelo?</p>
                <p className="text-muted-foreground">Baixe o formato aceito pelo sistema.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open("/modelo_transacoes.csv")}>
                Baixar CSV
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium">Formato esperado:</p>
              <p>descrição, valor, data (YYYY-MM-DD), tipo (income/expense)</p>
            </div>
            <Input type="file" accept=".csv" onChange={handleCsvUpload} />
            {csvPreview.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className={i === 0 ? "font-bold bg-muted" : ""}>
                        {row.map((cell, j) => <td key={j} className="p-1 border border-border">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={importCsv} disabled={!csvFile}>Importar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
