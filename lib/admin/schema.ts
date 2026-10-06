import { z } from "zod";
import { sanitizeText } from "@/lib/validation/schemas";

export const ContentSchema = z.object({
  title: z.string().trim().min(3, "Минимум 3 символа").max(160).transform(sanitizeText),
  description: z.string().trim().min(10, "Минимум 10 символов").max(400).transform(sanitizeText),
  body: z.string().max(40_000, "Слишком длинный текст").default(""),
  type: z.enum(["article", "book", "video", "podcast"]),
  category: z.string().min(1).max(40),
  author: z.string().trim().min(2, "Укажите автора").max(120).transform(sanitizeText),
  source: z.string().trim().max(120).default("PIGSEN").transform(sanitizeText),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || /^https:\/\//.test(u), "Ссылка должна начинаться с https://")
    .transform((u) => u || null)
    .nullable()
    .default(null),
  readingTime: z.number().int().min(1).max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  featured: z.boolean().default(false),
  premium: z.boolean().default(false),
  trending: z.number().int().min(0).max(10).default(0),
});
