# 🧾 PROMPT: Aplicação de Finanças Pessoais — FinanceApp

> **Como usar:** Cole este prompt integralmente no Claude, Cursor, v0.dev ou qualquer IA de código. Ele foi estruturado em seções para facilitar o desenvolvimento incremental.

---

## 🎯 VISÃO GERAL DO PROJETO

Você é um engenheiro full-stack sênior especializado em aplicações financeiras. Sua tarefa é desenvolver uma **aplicação web de finanças pessoais completa**, responsiva, moderna e segura, chamada **FinanceApp**.

A aplicação deve ser **100% gratuita para hospedar e operar**, usando apenas serviços com plano free generoso. O stack escolhido deve ser produtivo, tipado e escalável.

---

## 🛠️ STACK TECNOLÓGICO

### Frontend & Framework

- **Next.js+** com App Router
- **TypeScript** (strict mode)
- **Tailwind CSS** para estilização
- **shadcn/ui** como biblioteca de componentes
- **Recharts** para gráficos e dashboards
- **React Hook Form + Zod** para formulários e validação
- **next-themes** para dark/light mode

### Backend & Banco de Dados

- **Supabase** (PostgreSQL + Auth + Storage — plano free)
  - Row Level Security (RLS) ativo em todas as tabelas
  - Cada usuário enxerga **apenas seus próprios dados**
  - Autenticação via Supabase Auth (e-mail/senha + Google OAuth)

### Hospedagem (gratuita)

- **Vercel** (frontend + API routes do Next.js — plano hobby free)
- **Supabase** (banco de dados + auth — plano free)

### Exportação

- **jsPDF + jspdf-autotable** para exportação em PDF
- **xlsx (SheetJS)** para exportação em Excel/CSV

### Importação

- Parser de CSV customizado para importar transações em lote

---

## 🏗️ ARQUITETURA DO PROJETO

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── transacoes/
│   │   ├── contas/
│   │   ├── cartoes/
│   │   ├── faturas/
│   │   ├── categorias/
│   │   ├── relatorios/
│   │   └── configuracoes/
│   └── layout.tsx
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # Sidebar, Header, BottomNav
│   ├── forms/        # Formulários de transação, conta, cartão
│   ├── charts/       # Componentes de gráficos
│   └── tables/       # Tabelas de dados
├── lib/
│   ├── supabase/     # Client e server client
│   ├── validations/  # Schemas Zod
│   ├── utils/        # Helpers de formatação (BRL, datas pt-BR)
│   └── exporters/    # PDF e Excel
├── hooks/            # Custom hooks (useTransactions, useAccounts...)
└── types/            # Tipos TypeScript globais
```

---

## 🗄️ MODELAGEM DO BANCO DE DADOS (Supabase/PostgreSQL)

Implemente as seguintes tabelas com RLS habilitado:

```sql
-- Perfis de usuário (extensão da tabela auth.users do Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  currency TEXT DEFAULT 'BRL',
  locale TEXT DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contas bancárias e carteiras
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'wallet')),
  bank TEXT,
  balance NUMERIC(15,2) DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões de crédito
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT,
  limit_amount NUMERIC(15,2) NOT NULL,
  closing_day INT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faturas de cartão de crédito
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL, -- Primeiro dia do mês de referência
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias de transações
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  color TEXT,
  icon TEXT,
  parent_id UUID REFERENCES categories(id), -- Suporte a subcategorias
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'pix')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  date DATE NOT NULL,

  -- Conta ou cartão de origem
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Para transferências
  destination_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

  -- Categoria e subcategoria
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Recorrência
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_end_date DATE,
  recurrence_group_id UUID, -- Agrupa todas as ocorrências da mesma recorrência

  -- Parcelamento
  is_installment BOOLEAN DEFAULT FALSE,
  installment_number INT,
  installment_total INT,
  installment_group_id UUID, -- Agrupa todas as parcelas

  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de relacionamento transação <-> tags
CREATE TABLE transaction_tags (
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

-- Orçamentos mensais por categoria (opcional mas recomendado)
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  month DATE NOT NULL, -- Primeiro dia do mês
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (aplicar em TODAS as tabelas)
-- Exemplo para transactions:
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see their own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);
-- Repita o padrão para todas as tabelas acima.
```

---

## 🔐 AUTENTICAÇÃO

- Implementar com **Supabase Auth**
- Suporte a **e-mail + senha** e **Google OAuth**
- Middleware Next.js protegendo todas as rotas do dashboard
- Após login, redirecionar para `/dashboard`
- Após logout, redirecionar para `/login`
- Criar perfil automaticamente via trigger no Supabase ao registrar novo usuário:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 📱 PÁGINAS E FUNCIONALIDADES

### 1. `/dashboard` — Visão Geral

- Cards de resumo: **Saldo total**, **Receitas do mês**, **Despesas do mês**, **Saldo do mês**
- Gráfico de linha: evolução do saldo nos últimos 6 meses
- Gráfico de pizza/donut: despesas por categoria no mês atual
- Gráfico de barras: receitas vs despesas por mês (últimos 6 meses)
- Lista das últimas 10 transações com atalho para ver todas
- Cards de faturas abertas com alerta de vencimento próximo (≤ 5 dias)
- Seletor de período (mês/ano) que filtra todos os dados da página

### 2. `/transacoes` — Gestão de Transações

- Tabela completa com paginação (20 por página)
- Filtros: tipo, categoria, tag, conta/cartão, período, status
- Busca por descrição
- Botão "Nova Transação" abre modal/drawer com formulário
- Formulário de transação deve suportar:
  - **Tipo:** Receita, Despesa, Transferência, Pix
  - **Valor**, **Descrição**, **Data**, **Notas** (campo de texto livre)
  - **Conta** ou **Cartão de crédito** (origem)
  - **Destino** (para transferências e Pix)
  - **Categoria** + **Subcategoria** (carregadas dinamicamente)
  - **Tags** (multi-select com criação inline)
  - **Recorrente:** sim/não → se sim, escolher frequência e data fim
  - **Parcelado:** sim/não → se sim, quantas parcelas (gera N transações vinculadas)
  - **Status:** Pendente / Confirmado
- Ações por linha: Editar, Duplicar, Excluir (com confirmação)
- Ao excluir recorrente ou parcelado: perguntar se exclui só esta ou todas

### 3. `/contas` — Contas Bancárias

- Listar contas (corrente, poupança, carteira)
- Card por conta mostrando nome, banco, saldo atual e tipo
- Criar / Editar / Desativar conta
- Histórico de transações por conta

### 4. `/cartoes` — Cartões de Crédito

- Listar cartões com: nome, banco, limite total, limite disponível, fatura atual
- Criar / Editar / Desativar cartão
- Campos: nome, banco, limite, dia de fechamento, dia de vencimento, cor, ícone
- Calcular automaticamente o limite disponível = limite - total da fatura aberta

### 5. `/faturas` — Faturas dos Cartões

- Listar faturas por cartão e por mês
- Status visual: Aberta 🟡, Fechada 🟠, Paga ✅
- Ao abrir uma fatura: ver todas as transações vinculadas
- Ação "Marcar como paga" → registra pagamento e fecha fatura
- Alerta automático quando fatura fecha em ≤ 5 dias
- Gerar fatura do próximo mês automaticamente ao fechar a atual

### 6. `/categorias` — Categorias e Subcategorias

- Listar categorias por tipo (Receita / Despesa / Transferência)
- Criar categoria com: nome, tipo, cor, ícone, categoria pai (opcional)
- Exibir hierarquia: categoria → subcategorias
- Impedir exclusão de categorias com transações vinculadas (sugerir reatribuição)

### 7. `/relatorios` — Relatórios e Exportação

- Filtros: período (mês, trimestre, ano, personalizado), conta, cartão, categoria, tag
- Relatórios disponíveis:
  - **Extrato completo:** lista de transações filtradas
  - **Resumo por categoria:** total por categoria com % do gasto total
  - **Resumo mensal:** receitas, despesas e saldo por mês
  - **Análise de faturas:** histórico de faturas por cartão
- Botão **"Exportar PDF"** → gera PDF formatado com jsPDF
- Botão **"Exportar Excel/CSV"** → gera arquivo xlsx com SheetJS
- Botão **"Importar CSV"** → modal com:
  - Template de download para o usuário preencher
  - Upload do arquivo CSV
  - Preview das primeiras 5 linhas antes de confirmar
  - Mapeamento de colunas (descrição, valor, data, tipo, categoria)
  - Importação em lote com feedback de sucesso/erro por linha

### 8. `/configuracoes` — Configurações do Usuário

- Editar nome e avatar
- Alterar senha
- Preferências: moeda (padrão BRL), idioma (pt-BR), tema
- Gerenciar notificações de vencimento
- Zona de perigo: excluir conta com confirmação dupla

---

## 🔔 NOTIFICAÇÕES DE VENCIMENTO

- Implementar via **banner in-app** no topo do dashboard
- Lógica: buscar faturas com `due_date` nos próximos 5 dias e status `open` ou `closed`
- Exibir: "Fatura do [Nome do Cartão] vence em X dias — R$ [valor]"
- Permitir dispensar notificação por sessão
- Opcional (fase 2): integrar com **Supabase Edge Functions + Resend** (free tier) para envio de e-mail de lembrete

---

## 🎨 DESIGN E UX

### Visual

- Design **limpo, moderno e profissional**, voltado para finanças pessoais
- Paleta: tons neutros (slate/zinc) com acento em **verde** para receitas e **vermelho** para despesas
- Tipografia clara e legível
- Suporte completo a **dark mode** via `next-themes` (toggle no header)
- Ícones via **Lucide React**
- Feedback visual em todas as ações (toasts via **sonner**)

### Responsividade

- **Desktop (≥ 1024px):** Sidebar lateral fixa + conteúdo principal
- **Tablet (768px – 1023px):** Sidebar colapsável (overlay)
- **Mobile (< 768px):** Bottom navigation bar com 5 ícones principais + menu hamburger

### Formatação de dados (pt-BR)

- Valores sempre em **R$ #.##0,00**
- Datas em **dd/mm/yyyy**
- Usar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
- Usar `date-fns` com locale `ptBR` para todas as manipulações de data

---

## ♿ ACESSIBILIDADE E QUALIDADE

- Todos os formulários com labels associados e mensagens de erro acessíveis
- Navegação por teclado funcional em modais e dropdowns
- Contraste mínimo WCAG AA
- Loading states com skeletons (não spinners isolados)
- Empty states informativos com call-to-action
- Tratamento de erros da API com mensagens amigáveis em pt-BR

---

## 📋 CATEGORIAS PADRÃO (seed)

Ao criar um novo usuário, popular automaticamente com estas categorias:

**Despesas:** Alimentação, Moradia (Aluguel, Condomínio, IPTU), Transporte (Combustível, Transporte público, Uber), Saúde (Médico, Farmácia, Plano de saúde), Educação, Lazer (Streaming, Restaurante, Viagem), Vestuário, Assinaturas, Animais de estimação, Outros

**Receitas:** Salário, Freelance, Investimentos, Aluguel recebido, Outros

**Transferências:** Transferência entre contas

---

## 🚀 ORDEM DE DESENVOLVIMENTO RECOMENDADA

Desenvolva nesta sequência para ter sempre algo funcional:

1. **Setup inicial:** Next.js + TypeScript + Tailwind + shadcn/ui + Supabase
2. **Autenticação:** Login, registro, Google OAuth, middleware, trigger de perfil
3. **Layout base:** Sidebar, Header, BottomNav mobile, dark mode
4. **Contas e cartões:** CRUD completo
5. **Categorias e tags:** CRUD com hierarquia
6. **Transações:** Formulário completo + listagem + filtros
7. **Faturas:** Geração automática, cálculo de vencimento, pagamento
8. **Dashboard:** Gráficos e cards de resumo
9. **Relatórios:** Filtros + exportação PDF e Excel
10. **Importação CSV:** Template + upload + preview + importação em lote
11. **Notificações:** Banner in-app de vencimento
12. **Configurações:** Perfil, senha, preferências
13. **Polish:** Skeletons, empty states, toasts, testes de responsividade

---

## ⚙️ VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui

# URL da aplicação
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app

# Google OAuth (configurado no Supabase Dashboard)
# Não precisa de variáveis adicionais no Next.js — configurar direto no Supabase
```

---

## ✅ CRITÉRIOS DE ACEITE

A aplicação estará completa quando:

- [ ] Usuário consegue se registrar e logar (e-mail + Google)
- [ ] Cada usuário vê apenas seus próprios dados (RLS funcionando)
- [ ] É possível cadastrar contas correntes e cartões de crédito
- [ ] Transações únicas, recorrentes e parceladas funcionam corretamente
- [ ] Transferências e Pix entre contas atualizam os saldos corretamente
- [ ] Faturas são geradas e calculadas automaticamente por cartão/mês
- [ ] Dashboard exibe gráficos corretos com dados reais
- [ ] Exportação em PDF e Excel funciona com os filtros aplicados
- [ ] Importação de CSV valida e importa transações em lote
- [ ] Notificação in-app aparece para faturas vencendo em ≤ 5 dias
- [ ] Layout é responsivo em mobile, tablet e desktop
- [ ] Dark mode funciona em todas as páginas
- [ ] Todos os valores estão formatados em BRL (pt-BR)

---

_Prompt gerado com base nas necessidades específicas do projeto. Versão 1.0._
