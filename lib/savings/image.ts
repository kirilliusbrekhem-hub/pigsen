import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api/http";

export const MAX_GOAL_IMAGE_BYTES = 300 * 1024;
const RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Zod field: data URL string, null to remove, undefined to keep. Size is checked in `checkGoalImage`. */
export const GoalImageField = z.string().max(450_000, "Картинка больше 300 КБ").nullable().optional();

/** Validates a goal picture data URL; returns it unchanged or throws 422. */
export function checkGoalImage(value: string): string {
  const m = RE.exec(value);
  if (!m) throw new HttpError(422, "Нужна картинка JPEG, PNG или WebP", { image: "Неверный формат" });
  const b64 = m[2];
  const bytes = Math.floor((b64.length * 3) / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  if (bytes > MAX_GOAL_IMAGE_BYTES) throw new HttpError(422, "Картинка больше 300 КБ", { image: "Слишком большой файл" });
  return value;
}

export function decodeGoalImage(value: string): { type: string; body: Buffer } | null {
  const m = RE.exec(value);
  return m ? { type: `image/${m[1]}`, body: Buffer.from(m[2], "base64") } : null;
}

export function goalImageUrl(g: { id: string; image: string | null; updatedAt: Date }): string | null {
  return g.image ? `/api/savings/goals/${g.id}/image?v=${g.updatedAt.getTime()}` : null;
}
