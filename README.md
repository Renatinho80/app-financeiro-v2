# FinanceApp - Gestão Financeira Pessoal

O **FinanceApp** é uma aplicação completa de gestão financeira pessoal (PFM) construída para ajudar você a ter o controle total de suas finanças, categorizar despesas e monitorar o fechamento de faturas de cartão de crédito.

## 🚀 Tecnologias Integradas

- **Front-end**: Funciona com **Next.js 15** usando o App Router, permitindo navegação rápida e server components integrados.
- **Estilização**: Interface gráfica rica e agradável usando **Tailwind CSS** em conjunto com **shadcn/ui** e ícones do **Lucide React**.
- **Autenticação e Banco de Dados**: Usa o **Supabase** (PostgreSQL) para gerenciar dados via Row Level Security (RLS) e a autenticação de usuários.
- **Formulários e Validação**: Usa `react-hook-form` e `zod`.
- **Efeitos Dinâmicos e Notificações**: `sonner` para mensagens toast de sucesso/erro.

## ✨ Funcionalidades

- **Dashboard Integrado**: Totalizador de Despesas, Receitas e Saldo Consolidado de contas correntes/poupança/carteiras.
- **Gestão de Contas e Cartões**: Cadastre as origens de seu dinheiro. A plataforma entende o fechamento e vencimento de cartões e unifica faturas automaticamente.
- **Transações Detalhadas**: Categorização profunda, transações parceladas criadas automaticamente e suporte a compras recorrentes.
- **Extratos e Relatórios**: Relatórios gráficos e filtráveis por data ou categoria. 
- **Importação Simplificada**: Ferramenta de importação em CSV com modelo padronizado.

## 🛠️ Configuração e Execução

### Pré-requisitos
- **Node.js**: Versão 18.x ou superior.
- **Conta Supabase**: Para hospedar o backend.

### Passos

1. **Clone do Repositório**:
   ```bash
   git clone https://github.com/seu-usuario/app-financeiro-v2.git
   cd app-financeiro-v2
   ```

2. **Instalação das dependências**:
   ```bash
   npm install
   # ou yarn install / pnpm install
   ```

3. **Configuração de Variáveis de Ambiente**:
   Crie um arquivo `.env` ou `.env.local` na raiz do projeto contendo as credenciais do seu Supabase (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

4. **Configuração do Banco**:
   O arquivo `supabase-schema.sql` na raiz possui todas as triggers, views de relatórios, constraints, regras de RLS (segurança para múltiplos perfis se isolarem) e funções RPC necessárias. Execute estas queries na aba SQL do painel web do seu projeto Supabase.

5. **Servidor Local**:
   ```bash
   npm run dev
   ```

   Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver a aplicação ativa e acessar a tela de Login/Cadastro.

## 🤝 Contribuindo

Pull requests são sempre bem-vindos! Sinta-se livre para debater ideias de melhorias abrindo _issues_.

## 📄 Licença

Este projeto é desenvolvido para uso individual e protegido, adequando-se à licença MIT (ou conforme aplicável).
