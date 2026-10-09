import { z } from "zod";

/** Pro «Свой бизнес» skin: emoji/accent are checked against fixed lists in lib/biz/play.ts. */
export const CustomBody = z
  .object({
    emoji: z.string().min(1).max(16),
    accent: z.string().regex(/^#[0-9a-f]{6}$/),
    names: z.record(z.string().max(40).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/), z.string().max(30)).refine((r) => Object.keys(r).length <= 30, "Слишком много названий").optional(),
  })
  .strict();
