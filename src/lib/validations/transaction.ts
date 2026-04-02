import { z } from "zod/v4";

export const transactionSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  payment_method: z.enum(["pix", "ted", "doc", "cash"]).nullable().optional(),
  amount: z.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  notes: z.string().optional(),
  date: z.string().min(1, "Data é obrigatória"),
  account_id: z.string().uuid().nullable().optional(),
  credit_card_id: z.string().uuid().nullable().optional(),
  destination_account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_type: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable().optional(),
  recurrence_end_date: z.string().nullable().optional(),
  is_installment: z.boolean().default(false),
  installment_total: z.number().int().min(2).nullable().optional(),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  tag_ids: z.array(z.string().uuid()).optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
