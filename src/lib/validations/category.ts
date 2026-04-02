import { z } from "zod/v4";

export const categorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["income", "expense", "transfer"]),
  color: z.string().optional(),
  icon: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const tagSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  color: z.string().optional(),
});

export type TagFormData = z.infer<typeof tagSchema>;
