import { handler, HttpError, json, parseBody, requireApiUser } from "@/lib/api/http";
import { listSaved, saveItem } from "@/lib/content/saved";
import { trackQuest } from "@/lib/gamification/quests";
import { saveSchema } from "@/lib/validation/schemas";
import { CONTENT_TYPES, type ContentType } from "@/types";

export const GET = handler(async (req: Request) => {
  const user = await requireApiUser();
  const t = new URL(req.url).searchParams.get("type");
  const type = t && (CONTENT_TYPES as readonly string[]).includes(t) ? (t as ContentType) : undefined;
  return json({ items: await listSaved(user.id, type) });
});

export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  const { contentItemId } = await parseBody(req, saveSchema);
  const saved = await saveItem(user.id, contentItemId);
  if (!saved) throw new HttpError(404, "Материал не найден");
  await trackQuest(user.id, "save");
  return json({ saved: true }, 201);
});
