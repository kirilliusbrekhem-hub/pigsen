import { z } from "zod";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { createPost, listPosts, POST_MAX } from "@/lib/social/service";
import { KIND_IDS, TOPIC_IDS } from "@/lib/social/meta";
import { sanitizeText } from "@/lib/validation/schemas";

const schema = z.object({
  text: z.string().transform(sanitizeText).pipe(z.string().min(1, "Напишите что-нибудь").max(POST_MAX, `Максимум ${POST_MAX} символов`)),
  parentId: z.string().max(40).optional(),
  kind: z.enum(KIND_IDS).optional(),
  topic: z.enum(TOPIC_IDS).optional(),
});

const query = z.object({
  before: z.string().max(40).optional(),
  kind: z.enum(KIND_IDS).optional(),
  topic: z.enum(TOPIC_IDS).optional(),
  sort: z.enum(["new", "top"]).optional(),
});

async function proUser() {
  const user = await requireApiUser();
  if (!isPro(user.profile)) throw new HttpError(403, "Комьюнити доступно в Pro");
  return user;
}

export const GET = handler(async (req: Request) => {
  const user = await proUser();
  const sp = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v));
  const q = query.safeParse(sp);
  if (!q.success) throw new HttpError(422, "Некорректный фильтр");
  return json(await listPosts(user, q.data));
});

export const POST = handler(async (req: Request) => {
  const user = await proUser();
  const body = await parseBody(req, schema);
  if (body.parentId) enforceRateLimit(`community-reply:${user.id}`, 20, 10 * 60_000);
  else enforceRateLimit(`community:${user.id}`, 5, 10 * 60_000);
  return json({ post: await createPost(user, body.text, body) }, 201);
});
