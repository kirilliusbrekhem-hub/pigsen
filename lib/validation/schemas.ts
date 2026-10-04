import { z } from "zod";
import { AI_TONES, CONTENT_TYPES, THEMES } from "@/types";

const trimmed = (max: number) => z.string().trim().max(max);

export const registerSchema = z.object({
  name: trimmed(60).min(2, "Минимум 2 символа"),
  email: z.string().trim().toLowerCase().email("Некорректный email").max(120),
  password: z.string().min(8, "Минимум 8 символов").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email").max(120),
  password: z.string().min(1, "Введите пароль").max(128),
});

export const interestsSchema = z.object({
  interests: z.array(z.string().regex(/^[a-z-]+$/)).max(9),
});

const AVATAR_MAX = 200_000;
export const profileUpdateSchema = z.object({
  name: trimmed(60).min(2, "Минимум 2 символа").optional(),
  bio: trimmed(280).optional(),
  avatar: z
    .string()
    .max(AVATAR_MAX, "Изображение слишком большое")
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Поддерживаются PNG, JPEG и WebP")
    .nullable()
    .optional(),
  interests: interestsSchema.shape.interests.optional(),
  theme: z.enum(THEMES).optional(),
  aiTone: z.enum(AI_TONES).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(180).optional(),
  notifyDigest: z.boolean().optional(),
  notifyNewContent: z.boolean().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль").max(128),
  newPassword: z.string().min(8, "Минимум 8 символов").max(128),
});

export const AI_MESSAGE_MAX = 4000;
export const chatMessageSchema = z.object({
  content: z.string().trim().min(1, "Пустое сообщение").max(AI_MESSAGE_MAX, `Не больше ${AI_MESSAGE_MAX} символов`),
});

export const conversationCreateSchema = z.object({
  title: trimmed(120).optional(),
});

export const conversationRenameSchema = z.object({
  title: trimmed(120).min(1),
});

export const saveSchema = z.object({
  contentItemId: z.string().cuid(),
});

export const contentQuerySchema = z.object({
  type: z.enum(CONTENT_TYPES).optional(),
  category: z.string().regex(/^[a-z-]+$/).optional(),
  q: z.string().trim().max(120).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  type: z.enum(CONTENT_TYPES).optional(),
});
