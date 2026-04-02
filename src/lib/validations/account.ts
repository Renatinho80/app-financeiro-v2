import { z } from "zod/v4";

export const accountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["checking", "savings", "wallet"]),
  bank: z.string().optional(),
  balance: z.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type AccountFormData = z.infer<typeof accountSchema>;
