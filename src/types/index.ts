// ============================================================
// FinanceApp — TypeScript Types
// ============================================================

export type Profile = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  currency: string;
  locale: string;
  created_at: string;
  spending_limit: number | null;
};

export type AccountType = "checking" | "savings" | "wallet";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  bank: string | null;
  balance: number;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
};

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  bank: string | null;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
};

export type InvoiceStatus = "open" | "closed" | "paid";

export type Invoice = {
  id: string;
  credit_card_id: string;
  user_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total_amount: number;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
  // Joined fields
  credit_card?: CreditCard;
};

export type CategoryType = "income" | "expense" | "transfer";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
  // Joined fields
  subcategories?: Category[];
  parent?: Category;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export type TransactionType = "income" | "expense" | "transfer";
export type PaymentMethod = "pix" | "ted" | "doc" | "cash";
export type TransactionStatus = "pending" | "confirmed" | "cancelled";
export type RecurrenceType = "daily" | "weekly" | "monthly" | "yearly";

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  payment_method: PaymentMethod | null;
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  account_id: string | null;
  credit_card_id: string | null;
  invoice_id: string | null;
  destination_account_id: string | null;
  category_id: string | null;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  recurrence_end_date: string | null;
  recurrence_group_id: string | null;
  is_installment: boolean;
  installment_number: number | null;
  installment_total: number | null;
  installment_group_id: string | null;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  account?: Account;
  credit_card?: CreditCard;
  destination_account?: Account;
  category?: Category;
  tags?: Tag[];
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  month: string;
  created_at: string;
  // Joined fields
  category?: Category;
};

// Dashboard aggregates
export type DashboardSummary = {
  totalBalance: number;
  monthIncome: number;
  monthExpenses: number;
  monthBalance: number;
};

export type CategoryExpense = {
  category: string;
  color: string;
  amount: number;
  percentage: number;
};

export type MonthlyComparison = {
  month: string;
  income: number;
  expenses: number;
};

// Filter types
export type TransactionFilters = {
  type?: TransactionType;
  category_id?: string;
  tag_id?: string;
  account_id?: string;
  credit_card_id?: string;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
};
