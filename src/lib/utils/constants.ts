export const DEFAULT_CATEGORIES = {
  expense: [
    { name: "Alimentação", icon: "🍔", color: "#f97316" },
    { name: "Moradia", icon: "🏠", color: "#8b5cf6", subcategories: [
      { name: "Aluguel", icon: "🔑", color: "#8b5cf6" },
      { name: "Condomínio", icon: "🏢", color: "#8b5cf6" },
      { name: "IPTU", icon: "📄", color: "#8b5cf6" },
    ]},
    { name: "Transporte", icon: "🚗", color: "#3b82f6", subcategories: [
      { name: "Combustível", icon: "⛽", color: "#3b82f6" },
      { name: "Transporte público", icon: "🚌", color: "#3b82f6" },
      { name: "Uber", icon: "🚕", color: "#3b82f6" },
    ]},
    { name: "Saúde", icon: "🏥", color: "#ef4444", subcategories: [
      { name: "Médico", icon: "👨‍⚕️", color: "#ef4444" },
      { name: "Farmácia", icon: "💊", color: "#ef4444" },
      { name: "Plano de saúde", icon: "🏥", color: "#ef4444" },
    ]},
    { name: "Educação", icon: "📚", color: "#06b6d4" },
    { name: "Lazer", icon: "🎮", color: "#ec4899", subcategories: [
      { name: "Streaming", icon: "📺", color: "#ec4899" },
      { name: "Restaurante", icon: "🍽️", color: "#ec4899" },
      { name: "Viagem", icon: "✈️", color: "#ec4899" },
    ]},
    { name: "Vestuário", icon: "👕", color: "#14b8a6" },
    { name: "Assinaturas", icon: "📱", color: "#6366f1" },
    { name: "Animais de estimação", icon: "🐾", color: "#a855f7" },
    { name: "Outros", icon: "📦", color: "#64748b" },
  ],
  income: [
    { name: "Salário", icon: "💰", color: "#22c55e" },
    { name: "Freelance", icon: "💻", color: "#10b981" },
    { name: "Investimentos", icon: "📈", color: "#059669" },
    { name: "Aluguel recebido", icon: "🏠", color: "#15803d" },
    { name: "Outros", icon: "💵", color: "#4ade80" },
  ],
  transfer: [
    { name: "Transferência entre contas", icon: "🔄", color: "#0ea5e9" },
  ],
};

export const ACCOUNT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#22c55e",
  "#06b6d4", "#ef4444", "#a855f7", "#14b8a6", "#6366f1", "#64748b",
];

export const CHART_COLORS = [
  "#8b5cf6", "#3b82f6", "#06b6d4", "#22c55e", "#f97316",
  "#ec4899", "#ef4444", "#a855f7", "#14b8a6", "#6366f1",
  "#64748b", "#f59e0b",
];

export const BANKS = [
  "Nubank", "Itaú", "Bradesco", "Banco do Brasil", "Santander",
  "Caixa", "Inter", "C6 Bank", "BTG Pactual", "PicPay",
  "Mercado Pago", "PagBank", "Neon", "Next", "Original",
  "Sicoob", "Sicredi", "Banrisul", "Outro",
];
