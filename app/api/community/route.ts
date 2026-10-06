import { z } from "zod";
import { enforceRateLimit, handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { isPro } from "@/lib/billing/plan";
import { createPost, listPosts, POST_MAX } from "@/lib/social/service";
import { sanitizeText } from "@/lib/validation/schemas";

const schema = z.object({
  text: z.string().transform(sanitizeText).pipe(z.string().min(1, "Напишите что-нибудь").max(POST_MAX, `Максимум ${POST_MAX} символов`)),
  parentId: z.string().max(40).optional(),
});

async function proUser() {
  const user = await requireApiUser();
  if (!isPro(user.profile)) throw new HttpError(403, "Комьюнити доступно в Pro");
  return user;
}

export const GET = handler(async (req: Request) => {
  const user = await proUser();
  const before = new URL(req.url).searchParams.get("before")?.slice(0, 40) || undefined;
  return json(await listPosts(user, { before }));
});

export const POST = handler(async (req: Request) => {
  const user = await proUser();
  const body = await parseBody(req, schema);
  enforceRateLimit(`community:${user.id}`, 5, 10 * 60_000);
  return json({ post: await createPost(user, body.text, body.parentId) }, 201);
});
