import { z } from "zod/v4";

export const creditCardSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
    bank: z.string().max(100, "Nome do banco muito longo").optional(),
    limit_amount: z
      .number()
      .positive("Limite deve ser maior que zero")
      .max(10000000, "Limite excede o máximo permitido"),
    closing_day: z.number().int().min(1).max(31),
    due_day: z.number().int().min(1).max(31),
    color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Cor inválida — use formato hex (#RRGGBB)").optional(),
    icon: z.string().max(50, "Ícone inválido").optional(),
  })
  .refine((data) => data.closing_day !== data.due_day, {
    message: "Dia de fechamento e vencimento não podem ser iguais",
    path: ["due_day"],
  });

export type CreditCardFormData = z.infer<typeof creditCardSchema>;
