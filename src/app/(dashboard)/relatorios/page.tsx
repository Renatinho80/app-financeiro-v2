"use client";

import packageInfo from "../../../../package.json";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { FileDown, FileSpreadsheet, Upload, BarChart3, ChevronDown, ArrowUpDown, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useCallback } from "react";
import type { Transaction } from "@/types";
import type { jsPDF } from "jspdf";
import { useAccounts } from "@/hooks/use-accounts";
import { useCreditCards } from "@/hooks/use-credit-cards";
import { useCategories } from "@/hooks/use-categories";

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
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [totalRowsToImport, setTotalRowsToImport] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: number;
    skipped: number;
    details: { line: number; description: string; status: "success" | "error" | "skip"; reason: string }[];
  } | null>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  // Paginação e ordenação do extrato
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [sortField, setSortField] = useState<"date" | "description" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Import states
  const { accounts } = useAccounts();
  const { creditCards } = useCreditCards();
  const { allFlat, refetch: refetchCategories } = useCategories();
  const [importTargetType, setImportTargetType] = useState<"account" | "credit_card" | "">("");
  const [importTargetId, setImportTargetId] = useState("");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const REPORT_LIMIT = 5000;
    const { data, error } = await supabase
      .from("transactions")
      .select("*, category:categories(name, icon)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .limit(REPORT_LIMIT);

    if (error) {
      toast.error("Erro ao carregar relatório");
    } else {
      setTransactions((data as Transaction[]) || []);
      setCurrentPage(1);
      setPageInput("1");
      if (data && data.length === REPORT_LIMIT) {
        toast.warning("Relatório limitado a 5.000 transações. Reduza o intervalo de datas para ver todos os dados.");
      }
    }
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "description") cmp = a.description.localeCompare(b.description, "pt-BR");
      else if (sortField === "amount") cmp = Number(a.amount) - Number(b.amount);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [transactions, sortField, sortDir]);

  const totalReportPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize));
  const paginatedTransactions = sortedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, totalReportPages));
    setCurrentPage(clamped);
    setPageInput(String(clamped));
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

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
        doc.text(`Página ${i} de ${pageCount} - FinanceApp PRO v${packageInfo.version}`, 14, doc.internal.pageSize.height - 10);
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

  const MAX_FILE_SIZE_MB = 5;
  const MAX_IMPORT_ROWS = 5000;

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error("Arquivo muito grande", {
        description: `O tamanho máximo permitido é ${MAX_FILE_SIZE_MB}MB. Este arquivo tem ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
      });
      e.target.value = "";
      return;
    }

    setCsvFile(file);
    
    if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        let json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        // Parser C6 Bank: Pular primeira linha de metadados se for o extrato original do C6
        if (json.length > 0 && Array.isArray(json[0]) && typeof json[0][0] === 'string' && (json[0][0].startsWith('Nome:') || json[0][0].startsWith('Cartão:'))) {
          json = json.slice(1);
        }
        
        setCsvPreview(json.slice(0, 6).map(row => (row || []).map(v => String(v || ""))));
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const allLines = text.split("\n").filter(l => l.trim() !== "");
        if (allLines.length === 0) return;

        // Detectar delimitador inteligente baseado na primeira linha (headeR)
        const delimiters = [",", ";", "\t", "|"];
        const headerLine = allLines[0];
        const separator = delimiters.reduce((prev, curr) => {
          return (headerLine.split(curr).length > headerLine.split(prev).length) ? curr : prev;
        });

        const lines = allLines.map(line => line.split(separator).map(c => c.trim()));
        setCsvPreview(lines.slice(0, 6));
      };
      reader.readAsText(file);
    }
  };

  const importCsv = async () => {
    if (!csvFile || !importTargetType || !importTargetId) return;
    
    const isExcel = csvFile.name.endsWith('.xls') || csvFile.name.endsWith('.xlsx');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const processData = async (parsedLines: string[][]) => {
      if (parsedLines.length < 2) {
        toast.error("Arquivo vazio ou sem dados.");
        return;
      }

      const dataRows = parsedLines.length - 1;
      if (dataRows > MAX_IMPORT_ROWS) {
        toast.error("Arquivo com muitas linhas", {
          description: `Máximo de ${MAX_IMPORT_ROWS.toLocaleString("pt-BR")} linhas por importação. Este arquivo possui ${dataRows.toLocaleString("pt-BR")} linhas. Divida o arquivo e importe em partes.`,
        });
        return;
      }

      const headerRow = parsedLines[0].map(h => h.toLowerCase());
      
      const valRIndex = headerRow.findIndex(h => h.includes("valor (em r$)") || h.includes("valor em r$") || (h.includes("valor") && (h.includes("r$") || h.includes("brl"))));
      const valIndex = valRIndex !== -1 ? valRIndex : headerRow.findIndex(h => (h.includes("valor") || h.includes("amount") || h.includes("total")) && !h.includes("us$") && !h.includes("dólar") && !h.includes("dolar"));

      const colIndex = {
        date: headerRow.findIndex(h => h.includes("data") || h.includes("vencimento")),
        desc: headerRow.findIndex(h => (h.includes("desc") || h.includes("histórico")) && !h.includes("cartão") && !h.includes("cartao")),
        val: valIndex,
        type: headerRow.findIndex(h => h.includes("tipo") || h.includes("natureza")),
        method: headerRow.findIndex(h => h.includes("metodo") || h.includes("método") || h.includes("pagamento")),
        cat: headerRow.findIndex(h => h.includes("categoria")),
        parcela: headerRow.findIndex(h => h.includes("parcela"))
      };

      if (colIndex.date === -1 || colIndex.desc === -1 || colIndex.val === -1) {
        toast.error("Colunas obrigatórias não encontradas (Data, Descrição, Valor).");
        return;
      }

      setIsImporting(true);
      setImportProgress(0);
      setTotalRowsToImport(parsedLines.length - 1);

      const results: typeof importResults = { success: 0, errors: 0, skipped: 0, details: [] };
      const transactionsToInsert: any[] = [];
      const newCategoryNames = new Set<string>();

      // --- FASE 1: PRÉ-VALIDAÇÃO ---
      for (let i = 1; i < parsedLines.length; i++) {
        const row = parsedLines[i];
        if (row.length < 2 || (row.length === 1 && !row[0])) continue;

        let date = row[colIndex.date] || "";
        let description = colIndex.desc !== -1 ? row[colIndex.desc] : "";
        const valStr = colIndex.val !== -1 ? String(row[colIndex.val]) : "";

        // Concatenar parcela na descrição se existir
        if (colIndex.parcela !== -1 && row[colIndex.parcela] && row[colIndex.parcela].toLowerCase() !== "única") {
          description = `${description} (${row[colIndex.parcela]})`;
        }

        // Validar campos básicos
        if (!date || !description || !valStr) {
          results.errors++;
          results.details.push({ line: i + 1, description: description || "Linha vazia", status: "error", reason: "Campos obrigatórios ausentes" });
          continue;
        }

        // Validar data
        if (date.includes("/")) {
          const parts = date.split("/");
          if (parts.length === 3) {
            date = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        if (isNaN(new Date(date).getTime())) {
          results.errors++;
          results.details.push({ line: i + 1, description, status: "error", reason: "Formato de data inválido" });
          continue;
        }

        // Validar valor e tratar inversão C6 Bank
        let amountStr = valStr;
        if (amountStr.includes(",") && amountStr.includes(".")) {
          amountStr = amountStr.replace(/\./g, "").replace(",", ".");
        } else if (amountStr.includes(",")) {
          amountStr = amountStr.replace(",", ".");
        }
        
        let amountValue = parseFloat(amountStr);
        let type: "income" | "expense" | "transfer" = "expense";

        // Mapear Tipo e Método
        const rawType = colIndex.type !== -1 ? (row[colIndex.type] || "").toLowerCase() : "";
        
        if (rawType) {
          if (["receita", "entrada", "income"].includes(rawType)) type = "income";
          else if (["despesa", "saída", "saida", "gasto", "expense"].includes(rawType)) type = "expense";
          else if (["transferência", "transferencia", "transfer"].includes(rawType)) type = "transfer";
        } else if (isExcel) {
          // Lógica C6: Valor negativo = Pagamento/Estorno (Receita/Crédito na fatura), Positivo = Compra (Despesa)
          if (amountValue < 0) {
            type = "income";
            amountValue = Math.abs(amountValue);
          } else {
            type = "expense";
          }
        } else {
          amountValue = Math.abs(amountValue);
        }

        if (isNaN(amountValue)) {
          results.errors++;
          results.details.push({ line: i + 1, description, status: "error", reason: "Valor numérico inválido" });
          continue;
        }

        const rawMethod = colIndex.method !== -1 ? (row[colIndex.method] || "").toLowerCase() : "";
        let payment_method: "pix" | "ted" | "doc" | "cash" | null = null;
        if (rawMethod === "pix") payment_method = "pix";
        else if (rawMethod === "ted") payment_method = "ted";
        else if (rawMethod === "doc") payment_method = "doc";
        else if (["dinheiro", "espécie", "especie", "cash"].includes(rawMethod)) payment_method = "cash";

        const MAX_CAT_NAME_LENGTH = 100;
        const rawCatName = colIndex.cat !== -1 ? row[colIndex.cat]?.trim() : null;
        const catName = rawCatName && rawCatName !== "-" && rawCatName.length <= MAX_CAT_NAME_LENGTH
          ? rawCatName
          : null;
        if (catName) newCategoryNames.add(catName);

        transactionsToInsert.push({ date, description, amount: amountValue, type, payment_method, rawCategory: catName, line: i + 1 });
      }

      // Checar limite de erro na pré-validação (25%)
      const totalRows = parsedLines.length - 1;
      if (results.errors / totalRows > 0.25) {
        toast.error(`Importação abortada: ${Math.round((results.errors / totalRows) * 100)}% das linhas possuem erros de formato.`);
        setImportResults(results);
        setIsResultsOpen(true);
        setIsImporting(false);
        return;
      }

      // --- FASE 2: EXECUÇÃO ---
      const insertedIds: string[] = [];
      const createdCategoryIds: string[] = [];
      const flatCats = allFlat;
      const categoryMap = new Map(flatCats.map(c => [c.name.toLowerCase(), c.id]));

      // Criar categorias faltantes
      for (const catName of Array.from(newCategoryNames)) {
        if (!categoryMap.has(catName.toLowerCase())) {
          const { data: newCat } = await supabase.from('categories').insert({ user_id: user.id, name: catName, type: 'expense' }).select('id').single();
          if (newCat) {
            categoryMap.set(catName.toLowerCase(), newCat.id);
            createdCategoryIds.push(newCat.id);
          }
        }
      }
      refetchCategories();

      for (let i = 0; i < transactionsToInsert.length; i++) {
        const tx = transactionsToInsert[i];

        const currentCatId = (tx.rawCategory && tx.rawCategory !== "-") ? categoryMap.get(tx.rawCategory.toLowerCase()) : null;

        // 3a. Deduplication check
        let duplicateQuery = supabase.from("transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", tx.date)
          .eq("amount", tx.amount)
          .eq("description", tx.description);

        if (currentCatId) {
          duplicateQuery = duplicateQuery.eq("category_id", currentCatId);
        } else {
          duplicateQuery = duplicateQuery.is("category_id", null);
        }

        const { data: existing } = await duplicateQuery.maybeSingle();

        if (existing) {
          results.skipped++;
          results.details.push({ line: tx.line, description: tx.description, status: "skip", reason: "Transação idêntica já existe (mesma data, valor, categoria e nome)" });
          setImportProgress(i + 1);
          continue;
        }

        let invoiceId = null;
        if (importTargetType === "credit_card" && importTargetId) {
          const { data: invId } = await supabase.rpc("get_or_create_invoice", { _credit_card_id: importTargetId, _transaction_date: tx.date, _ignore_closed: true });
          invoiceId = invId;
        }

        const { data: inserted, error } = await supabase.from("transactions").insert({
          user_id: user.id,
          description: tx.description,
          amount: tx.amount,
          date: tx.date,
          type: tx.type,
          payment_method: tx.payment_method,
          category_id: currentCatId,
          account_id: importTargetType === "account" ? importTargetId : null,
          credit_card_id: importTargetType === "credit_card" ? importTargetId : null,
          invoice_id: invoiceId,
          status: "confirmed"
        }).select("id").single();

        if (error) {
          results.errors++;
          results.details.push({ line: tx.line, description: tx.description, status: "error", reason: error.message });
          
          // Check for emergency rollback
          if (results.errors / totalRows > 0.25) {
            toast.error("Muitos erros detectados durante a inserção. Iniciando limpeza automática...");
            if (insertedIds.length > 0) {
              await supabase.from("transactions").delete().in("id", insertedIds);
            }
            if (createdCategoryIds.length > 0) {
              await supabase.from("categories").delete().in("id", createdCategoryIds);
            }
            results.details.push({ line: 0, description: "SISTEMA", status: "error", reason: "ROLLBACK EXECUTADO: Todas as inserções desta sessão foram removidas." });
            setImportResults(results);
            setIsResultsOpen(true);
            setIsImporting(false);
            return;
          }
        } else {
          results.success++;
          if (inserted) insertedIds.push(inserted.id);
        }
        setImportProgress(i + 1);
      }

      setImportResults(results);
      setIsResultsOpen(true);
      setIsImporting(false);
      setIsImportOpen(false);
      setCsvFile(null);
      setImportProgress(0);
      
      // Marcar faturas anteriores como pagas se for cartão
      if (importTargetType === "credit_card") {
         const today = new Date().toISOString().split('T')[0];
         await supabase.from("invoices")
          .update({ status: 'paid' })
          .lt("closing_date", today)
          .eq("credit_card_id", importTargetId)
          .eq("status", "open");
      }
      
      fetchReport();
    };

    if (isExcel) {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        let json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
        
        // Parser C6 Bank: Pular primeira linha de metadados se for o extrato original do C6
        if (json.length > 0 && Array.isArray(json[0]) && typeof json[0][0] === 'string' && (json[0][0].startsWith('Nome:') || json[0][0].startsWith('Cartão:'))) {
          json = json.slice(1);
        }
        
        processData(json.map(row => (row || []).map(v => String(v ?? ""))));
      };
      reader.readAsArrayBuffer(csvFile);
    } else {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const text = ev.target?.result as string;
        const lines = text.split("\n").filter(l => l.trim() !== "");
        if (lines.length < 2) return processData([]);
        
        const delimiters = [",", ";", "\t", "|"];
        const headerLine = lines[0];
        const separator = delimiters.reduce((prev, curr) => {
          return (headerLine.split(curr).length > headerLine.split(prev).length) ? curr : prev;
        });
        
        processData(lines.map(l => l.split(separator).map(c => c.trim())));
      };
      reader.readAsText(csvFile);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}><FileDown className="w-4 h-4 mr-1" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="gap-1">
            <Upload className="w-4 h-4" />
            Importar Arquivo
          </Button>
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

        <TabsContent value="extract" className="mt-4 space-y-3">
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
            <>
              {/* Toolbar: ordenação + linhas por página */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                  {(["date", "description", "amount"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => toggleSort(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-md border transition-colors",
                        sortField === f
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 font-medium"
                          : "border-transparent hover:bg-muted"
                      )}
                    >
                      {f === "date" ? "Data" : f === "description" ? "Descrição" : "Valor"}
                      {sortField === f && (sortDir === "asc" ? " ↑" : " ↓")}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Linhas:</span>
                  {[5, 10, 20, 40].map(n => (
                    <button
                      key={n}
                      onClick={() => { setPageSize(n); goToPage(1); }}
                      className={cn(
                        "px-2 py-1 rounded-md border transition-colors",
                        pageSize === n
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 font-medium"
                          : "border-transparent hover:bg-muted"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista paginada */}
              <div className="space-y-1">
                {paginatedTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-muted-foreground w-20 shrink-0">{formatDate(tx.date)}</span>
                      <span className="truncate">{tx.description}</span>
                    </div>
                    <span className={cn("shrink-0 ml-2", tx.type === "income" ? "text-emerald-500" : "text-red-500")}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Controles de paginação */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border text-xs text-muted-foreground">
                <span>{transactions.length} transação(ões) · página {currentPage} de {totalReportPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <form onSubmit={e => { e.preventDefault(); goToPage(Number(pageInput)); }}>
                    <input
                      type="number"
                      min={1}
                      max={totalReportPages}
                      value={pageInput}
                      onChange={e => setPageInput(e.target.value)}
                      onBlur={() => goToPage(Number(pageInput))}
                      className="w-12 text-center border border-border rounded-md px-1 py-0.5 bg-background text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </form>
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalReportPages} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => goToPage(totalReportPages)} disabled={currentPage === totalReportPages} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
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
      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) {
          setCsvFile(null);
          setCsvPreview([]);
          setImportTargetType("");
          setImportTargetId("");
          setImportProgress(0);
          setTotalRowsToImport(0);
        }
      }}>
        <DialogContent className="max-w-[90vw] md:max-w-[80vw] w-full overflow-hidden flex flex-col p-4 sm:p-6 transition-all">
          <DialogHeader className="pb-2"><DialogTitle className="text-xl font-bold">Importar Transações (CSV ou Excel)</DialogTitle></DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[75vh] px-1 custom-scrollbar">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-emerald-500/10 border-emerald-500/20">
              <div className="text-sm">
                <p className="font-medium">Precisa do modelo?</p>
                <p className="text-muted-foreground">Baixe o formato aceito pelo sistema.</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileDown className="w-4 h-4" />
                    Baixar Modelo
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                } />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    const csvContent = "\uFEFFData,Descrição,Categoria,Valor (em R$),Tipo,Método,Parcela\n" +
                      "2026-04-01,Assinatura Spotify,Assinatura,-14.90,expense,pix,1/1\n" +
                      "2026-04-05,Pix Recebido,Outros,150.00,income,pix,Única\n" +
                      "2026-04-10,Mercado Central,Alimentação,350.50,expense,cash,1/1\n" +
                      "2026-04-12,Amazon Compra,Compras,1200.00,expense,,1/10\n" +
                      "2026-04-15,Reembolso,,50.00,income,ted,";
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute("download", "modelo_transacoes.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Modelo CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => {
                    const XLSX = await import("xlsx");
                    const data = [
                      ["Data", "Descrição", "Categoria", "Valor (em R$)", "Tipo", "Método", "Parcela"],
                      ["2026-04-01", "Assinatura Spotify", "Assinatura", -14.90, "expense", "pix", "1/1"],
                      ["2026-04-05", "Pix Recebido", "Outros", 150.00, "income", "pix", "Única"],
                      ["2026-04-10", "Mercado Central", "Alimentação", 350.50, "expense", "cash", "1/1"],
                      ["2026-04-12", "Amazon Compra", "Compras", 1200.00, "expense", "", "1/10"],
                      ["2026-04-15", "Reembolso", "", 50.00, "income", "ted", ""]
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Transações");
                    XLSX.writeFile(wb, "modelo_transacoes.xlsx");
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Modelo Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium">Formato esperado (Campos OBRIGATÓRIOS):</p>
              <p>Data, Descrição, Valor. (Opcionais: Tipo, Método, Categoria)</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vincular à:</Label>
                <Select value={importTargetType} onValueChange={(v) => { setImportTargetType(v as any); setImportTargetId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo">
                      {importTargetType === "account" ? "Conta Bancária" : importTargetType === "credit_card" ? "Cartão de Crédito" : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Conta Bancária</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Destino:</Label>
                <Select value={importTargetId} onValueChange={(v) => setImportTargetId(v || "")} disabled={!importTargetType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino">
                      {importTargetId ? (
                        importTargetType === "account" 
                          ? accounts.find(a => a.id === importTargetId)?.name 
                          : creditCards.find(c => c.id === importTargetId)?.name
                      ) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {importTargetType === 'account' && accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    {importTargetType === 'credit_card' && creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Arquivo CSV/Excel:</Label>
              <Input key={isImportOpen ? 'open' : 'closed'} type="file" accept=".csv, .xls, .xlsx" onChange={handleCsvUpload} />
            </div>

            {csvPreview.length > 0 && (
              <div className="border rounded-xl overflow-x-auto bg-muted/20 max-w-full shadow-inner">
                <Table className="w-full">
                  <TableBody>
                    {csvPreview.slice(0, 6).map((row, i) => (
                      <TableRow key={i} className={cn(
                        "hover:bg-muted/30 transition-colors",
                        i === 0 ? "bg-muted font-bold sticky top-0" : ""
                      )}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="p-3 text-[11px] whitespace-nowrap border-r border-border/50 last:border-0" title={cell}>
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                onClick={importCsv} 
                disabled={!csvFile || !importTargetId}
              >
                Iniciar Importação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Processando Importação</DialogTitle></DialogHeader>
          <div className="py-6 space-y-4 text-center">
             <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Analizando e enviando...</span>
                <span className="font-bold">{importProgress} / {totalRowsToImport}</span>
             </div>
             <Progress value={(importProgress / (totalRowsToImport || 1)) * 100} className="h-3" />
             <p className="text-xs text-muted-foreground italic">
                Aguarde, não atualize a página até o fim.
             </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Results Report Dialog */}
      <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Resultado da Importação
            </DialogTitle>
          </DialogHeader>

          {importResults && (
            <div className="flex-1 overflow-hidden flex flex-col gap-6 py-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center">
                  <p className="text-[10px] text-emerald-600 font-black uppercase mb-1">Sucesso</p>
                  <p className="text-2xl font-black text-emerald-700">{importResults.success}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center">
                  <p className="text-[10px] text-amber-600 font-black uppercase mb-1">Pulados</p>
                  <p className="text-2xl font-black text-amber-700">{importResults.skipped}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-center">
                  <p className="text-[10px] text-red-600 font-black uppercase mb-1">Erros</p>
                  <p className="text-2xl font-black text-red-700">{importResults.errors}</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 border rounded-lg">
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.details.map((detail, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-[10px]">{detail.line || "-"}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-[10px] font-medium">{detail.description}</TableCell>
                          <TableCell>
                            {detail.status === "error" ? (
                              <Badge variant="destructive" className="text-[9px] h-5 px-1.5 py-0">Erro</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] h-5 px-1.5 py-0 text-amber-600 border-amber-200 bg-amber-50">Pulado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">{detail.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <Button onClick={() => setIsResultsOpen(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 py-6 font-bold shadow-lg shadow-emerald-200">
                Fechar Relatório
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
