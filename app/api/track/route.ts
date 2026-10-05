import { z } from "zod";
import { enforceRateLimit, handler, json, parseBody, requireApiUser } from "@/lib/api/http";
import { prisma } from "@/lib/db/prisma";
import { recordView } from "@/lib/content/service";
import { startLesson } from "@/lib/learning/service";

const Body = z.object({ kind: z.enum(["view", "lesson"]), id: z.string().min(1).max(40) });

/** Records that the user opened a material or a lesson. Sent by the page after it mounts, never during render. */
export const POST = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`track:${user.id}`, 120, 60_000);
  const { kind, id } = await parseBody(req, Body);
  if (kind === "view") {
    if (await prisma.contentItem.findUnique({ where: { id }, select: { id: true } })) await recordView(user.id, id);
  } else if (await prisma.lesson.findUnique({ where: { id }, select: { id: true } })) {
    await startLesson(user.id, id);
  }
  return json({ ok: true });
});
