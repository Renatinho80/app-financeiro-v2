import { z } from "zod/v4";

export const categorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80, "Nome muito longo"),
  type: z.enum(["income", "expense", "transfer"]),
  color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Cor inválida — use formato hex (#RRGGBB)").optional(),
  icon: z.string().max(50, "Ícone inválido").optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const tagSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50, "Nome muito longo"),
  color: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Cor inválida — use formato hex (#RRGGBB)").optional(),
});

export type TagFormData = z.infer<typeof tagSchema>;
