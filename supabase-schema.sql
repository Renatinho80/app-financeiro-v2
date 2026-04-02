-- ============================================================
-- FinanceApp — Supabase Schema
-- Execute este SQL no Supabase Dashboard → SQL Editor
-- ============================================================

-- Perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  currency TEXT DEFAULT 'BRL',
  locale TEXT DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
CREATE POLICY "Users can manage their own profile" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Trigger: criar perfil ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Contas bancárias
CREATE TABLE IF NOT EXISTS accounts (
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

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own accounts" ON accounts;
CREATE POLICY "Users can manage their own accounts" ON accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cartões de crédito
CREATE TABLE IF NOT EXISTS credit_cards (
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

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own credit_cards" ON credit_cards;
CREATE POLICY "Users can manage their own credit_cards" ON credit_cards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Faturas
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  closing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
CREATE POLICY "Users can manage their own invoices" ON invoices FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  color TEXT,
  icon TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own categories" ON categories;
CREATE POLICY "Users can manage their own categories" ON categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own tags" ON tags;
CREATE POLICY "Users can manage their own tags" ON tags FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transações
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  payment_method TEXT CHECK (payment_method IN ('pix', 'ted', 'doc', 'cash')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  date DATE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  destination_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_end_date DATE,
  recurrence_group_id UUID,
  is_installment BOOLEAN DEFAULT FALSE,
  installment_number INT,
  installment_total INT,
  installment_group_id UUID,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
CREATE POLICY "Users can manage their own transactions" ON transactions FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    (account_id IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE id = account_id AND user_id = auth.uid())) AND
    (credit_card_id IS NULL OR EXISTS (SELECT 1 FROM credit_cards WHERE id = credit_card_id AND user_id = auth.uid())) AND
    (destination_account_id IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE id = destination_account_id AND user_id = auth.uid())) AND
    (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE id = category_id AND user_id = auth.uid()))
  );

-- Transaction Tags
CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own transaction_tags" ON transaction_tags;
CREATE POLICY "Users can manage their own transaction_tags" ON transaction_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));

-- Orçamentos
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  month DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own budgets" ON budgets;
CREATE POLICY "Users can manage their own budgets" ON budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Função para seed de categorias padrão ao criar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS trigger AS $$
DECLARE
  _user_id UUID := NEW.id;
  _parent_id UUID;
BEGIN
  -- Despesas
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Alimentação', 'expense', '🍔', '#f97316');
  
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Moradia', 'expense', '🏠', '#8b5cf6') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Aluguel', 'expense', '🔑', '#8b5cf6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Condomínio', 'expense', '🏢', '#8b5cf6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'IPTU', 'expense', '📄', '#8b5cf6', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Transporte', 'expense', '🚗', '#3b82f6') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Combustível', 'expense', '⛽', '#3b82f6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Transporte público', 'expense', '🚌', '#3b82f6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Uber', 'expense', '🚕', '#3b82f6', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Saúde', 'expense', '🏥', '#ef4444') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Médico', 'expense', '👨‍⚕️', '#ef4444', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Farmácia', 'expense', '💊', '#ef4444', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Plano de saúde', 'expense', '🏥', '#ef4444', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Educação', 'expense', '📚', '#06b6d4');

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Lazer', 'expense', '🎮', '#ec4899') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Streaming', 'expense', '📺', '#ec4899', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Restaurante', 'expense', '🍽️', '#ec4899', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Viagem', 'expense', '✈️', '#ec4899', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Vestuário', 'expense', '👕', '#14b8a6');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Assinaturas', 'expense', '📱', '#6366f1');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Animais de estimação', 'expense', '🐾', '#a855f7');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Outros', 'expense', '📦', '#64748b');

  -- Receitas
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Salário', 'income', '💰', '#22c55e');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Freelance', 'income', '💻', '#10b981');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Investimentos', 'income', '📈', '#059669');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Aluguel recebido', 'income', '🏠', '#15803d');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Outros', 'income', '💵', '#4ade80');

  -- Transferência
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Transferência entre contas', 'transfer', '🔄', '#0ea5e9');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_profile_created_seed_categories ON profiles;
CREATE TRIGGER on_profile_created_seed_categories
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();

-- ============================================================
-- RPC: Resetar conta de usuário (Limpa todos os dados)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_user_account()
RETURNS void AS $$
DECLARE
  _user_id UUID := auth.uid();
  _parent_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  DELETE FROM transactions WHERE user_id = _user_id;
  DELETE FROM accounts WHERE user_id = _user_id;
  DELETE FROM credit_cards WHERE user_id = _user_id;
  DELETE FROM budgets WHERE user_id = _user_id;
  DELETE FROM tags WHERE user_id = _user_id;
  DELETE FROM goals WHERE user_id = _user_id;
  DELETE FROM categories WHERE user_id = _user_id;

  -- Re-seed padrão
  -- Despesas
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Alimentação', 'expense', '🍔', '#f97316');
  
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Moradia', 'expense', '🏠', '#8b5cf6') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Aluguel', 'expense', '🔑', '#8b5cf6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Condomínio', 'expense', '🏢', '#8b5cf6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'IPTU', 'expense', '📄', '#8b5cf6', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Transporte', 'expense', '🚗', '#3b82f6') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Combustível', 'expense', '⛽', '#3b82f6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Transporte público', 'expense', '🚌', '#3b82f6', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Uber', 'expense', '🚕', '#3b82f6', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Saúde', 'expense', '🏥', '#ef4444') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Médico', 'expense', '👨‍⚕️', '#ef4444', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Farmácia', 'expense', '💊', '#ef4444', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Plano de saúde', 'expense', '🏥', '#ef4444', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Educação', 'expense', '📚', '#06b6d4');

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Lazer', 'expense', '🎮', '#ec4899') RETURNING id INTO _parent_id;
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Streaming', 'expense', '📺', '#ec4899', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Restaurante', 'expense', '🍽️', '#ec4899', _parent_id);
  INSERT INTO categories (user_id, name, type, icon, color, parent_id) VALUES (_user_id, 'Viagem', 'expense', '✈️', '#ec4899', _parent_id);

  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Vestuário', 'expense', '👕', '#14b8a6');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Assinaturas', 'expense', '📱', '#6366f1');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Animais de estimação', 'expense', '🐾', '#a855f7');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Outros', 'expense', '📦', '#64748b');

  -- Receitas
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Salário', 'income', '💰', '#22c55e');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Freelance', 'income', '💻', '#10b981');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Investimentos', 'income', '📈', '#059669');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Aluguel recebido', 'income', '🏠', '#15803d');
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Outros', 'income', '💵', '#4ade80');

  -- Transferência
  INSERT INTO categories (user_id, name, type, icon, color) VALUES (_user_id, 'Transferência entre contas', 'transfer', '🔄', '#0ea5e9');
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- ============================================================
-- RPC: Atualizar saldo de conta (incremento/decremento)
-- Chamada pelo frontend em use-transactions.ts
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_account_balance_fn(
  _account_id UUID,
  _amount NUMERIC(15,2)
)
RETURNS VOID AS $$
BEGIN
  UPDATE accounts
  SET balance = balance + _amount
  WHERE id = _account_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- RPC: Obter ou criar fatura para um cartão de crédito
-- Dado um cartão e uma data de compra, retorna o invoice_id
-- da fatura correspondente (cria se não existir)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_invoice(
  _credit_card_id UUID,
  _user_id UUID,
  _transaction_date DATE
)
RETURNS UUID AS $$
DECLARE
  _closing_day INT;
  _due_day INT;
  _ref_month DATE;
  _closing_date DATE;
  _due_date DATE;
  _invoice_id UUID;
BEGIN
  IF _user_id != auth.uid() THEN
    RAISE EXCEPTION 'Acesso Negado';
  END IF;

  -- Buscar dias de fechamento e vencimento do cartão
  SELECT closing_day, due_day INTO _closing_day, _due_day
  FROM credit_cards WHERE id = _credit_card_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão de crédito não pertence ao usuário ou não existe';
  END IF;

  -- Determinar o mês de referência da fatura
  -- Se a compra é DEPOIS do fechamento, vai para a fatura do mês seguinte
  IF EXTRACT(DAY FROM _transaction_date) > _closing_day THEN
    _ref_month := DATE_TRUNC('month', _transaction_date) + INTERVAL '1 month';
  ELSE
    _ref_month := DATE_TRUNC('month', _transaction_date);
  END IF;

  -- Calcular data de fechamento (closing_day do mês anterior ao ref_month)
  _closing_date := (_ref_month - INTERVAL '1 month') +
    (LEAST(_closing_day, EXTRACT(DAY FROM (DATE_TRUNC('month', _ref_month - INTERVAL '1 month') + INTERVAL '1 month' - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day';

  -- Calcular data de vencimento (due_day do mês de referência)
  _due_date := _ref_month +
    (LEAST(_due_day, EXTRACT(DAY FROM (DATE_TRUNC('month', _ref_month) + INTERVAL '1 month' - INTERVAL '1 day'))::INT) - 1) * INTERVAL '1 day';

  -- Tentar encontrar fatura existente
  SELECT id INTO _invoice_id
  FROM invoices
  WHERE credit_card_id = _credit_card_id
    AND reference_month = _ref_month
  LIMIT 1;

  -- Se não encontrou, criar
  IF _invoice_id IS NULL THEN
    INSERT INTO invoices (credit_card_id, user_id, reference_month, closing_date, due_date, total_amount, status)
    VALUES (_credit_card_id, _user_id, _ref_month, _closing_date, _due_date, 0, 'open')
    RETURNING id INTO _invoice_id;
  END IF;

  RETURN _invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- Trigger: Recalcular total da fatura quando transações mudam
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalculate_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  _invoice_id UUID;
BEGIN
  -- Determinar qual invoice_id foi afetado
  IF TG_OP = 'DELETE' THEN
    _invoice_id := OLD.invoice_id;
  ELSE
    _invoice_id := NEW.invoice_id;
  END IF;

  -- Se tinha invoice_id no OLD (update que muda de fatura), recalcular a antiga também
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET total_amount = COALESCE((
      SELECT SUM(amount) FROM transactions WHERE invoice_id = OLD.invoice_id AND status != 'cancelled'
    ), 0)
    WHERE id = OLD.invoice_id;
  END IF;

  -- Recalcular a fatura atual
  IF _invoice_id IS NOT NULL THEN
    UPDATE invoices
    SET total_amount = COALESCE((
      SELECT SUM(amount) FROM transactions WHERE invoice_id = _invoice_id AND status != 'cancelled'
    ), 0)
    WHERE id = _invoice_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS on_transaction_insert_recalc_invoice ON transactions;
CREATE TRIGGER on_transaction_insert_recalc_invoice
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.invoice_id IS NOT NULL)
  EXECUTE FUNCTION public.recalculate_invoice_total();

DROP TRIGGER IF EXISTS on_transaction_update_recalc_invoice ON transactions;
CREATE TRIGGER on_transaction_update_recalc_invoice
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (OLD.invoice_id IS NOT NULL OR NEW.invoice_id IS NOT NULL)
  EXECUTE FUNCTION public.recalculate_invoice_total();

DROP TRIGGER IF EXISTS on_transaction_delete_recalc_invoice ON transactions;
CREATE TRIGGER on_transaction_delete_recalc_invoice
  AFTER DELETE ON transactions
  FOR EACH ROW
  WHEN (OLD.invoice_id IS NOT NULL)
  EXECUTE FUNCTION public.recalculate_invoice_total();

-- ============================================================
-- Trigger: Atualizar saldos em transferências/Pix
-- Ao inserir: debita origem, credita destino
-- Ao excluir: reverte ambos
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_transfer_balances()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Debitar conta de origem
    IF NEW.account_id IS NOT NULL THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
    -- Creditar conta de destino
    IF NEW.destination_account_id IS NOT NULL THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.destination_account_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Reverter: creditar conta de origem
    IF OLD.account_id IS NOT NULL THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    END IF;
    -- Reverter: debitar conta de destino
    IF OLD.destination_account_id IS NOT NULL THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.destination_account_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

DROP TRIGGER IF EXISTS on_transfer_insert_balances ON transactions;
CREATE TRIGGER on_transfer_insert_balances
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.type IN ('transfer'))
  EXECUTE FUNCTION public.handle_transfer_balances();

DROP TRIGGER IF EXISTS on_transfer_delete_balances ON transactions;
CREATE TRIGGER on_transfer_delete_balances
  AFTER DELETE ON transactions
  FOR EACH ROW
  WHEN (OLD.type IN ('transfer'))
  EXECUTE FUNCTION public.handle_transfer_balances();

-- ============================================================
-- Trigger: Atualizar saldo para receitas/despesas simples
-- (Apenas para transações com account_id, sem credit_card)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_account_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.account_id IS NOT NULL AND NEW.credit_card_id IS NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.account_id IS NOT NULL AND OLD.credit_card_id IS NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_income_expense_insert_balance ON transactions;
CREATE TRIGGER on_income_expense_insert_balance
  AFTER INSERT ON transactions
  FOR EACH ROW
  WHEN (NEW.type IN ('income', 'expense') AND NEW.account_id IS NOT NULL AND NEW.credit_card_id IS NULL)
  EXECUTE FUNCTION public.handle_account_balance_on_transaction();

DROP TRIGGER IF EXISTS on_income_expense_delete_balance ON transactions;
CREATE TRIGGER on_income_expense_delete_balance
  AFTER DELETE ON transactions
  FOR EACH ROW
  WHEN (OLD.type IN ('income', 'expense') AND OLD.account_id IS NOT NULL AND OLD.credit_card_id IS NULL)
  EXECUTE FUNCTION public.handle_account_balance_on_transaction();

-- ============================================================
-- Metas Financeiras (Goals)
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(15,2) NOT NULL,
  current_amount NUMERIC(15,2) DEFAULT 0,
  color TEXT,
  icon TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own goals" ON goals;
CREATE POLICY "Users can manage their own goals" ON goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
