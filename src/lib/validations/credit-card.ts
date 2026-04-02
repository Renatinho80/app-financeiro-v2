import { z } from "zod/v4";

export const creditCardSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  bank: z.string().optional(),
  limit_amount: z.number().positive("Limite deve ser maior que zero"),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type CreditCardFormData = z.infer<typeof creditCardSchema>;
