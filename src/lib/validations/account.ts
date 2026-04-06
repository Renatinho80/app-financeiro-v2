import { z } from "zod/v4";

export const accountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  type: z.enum(["checking", "savings", "wallet"]),
  bank: z.string().max(100, "Nome do banco muito longo").optional(),
  // Aceita valores negativos (saldo devedor), mas limita amplitude para evitar abuse
  balance: z.number().min(-999999999, "Saldo inválido").max(999999999, "Saldo inválido").default(0),
  // Hex color: #RGB ou #RRGGBB
  color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Cor inválida — use formato hex (#RRGGBB)").optional(),
  // Ícone: string curta (emoji ou nome de ícone)
  icon: z.string().max(50, "Ícone inválido").optional(),
});

export type AccountFormData = z.infer<typeof accountSchema>;
