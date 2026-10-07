import { prisma } from "@/lib/db/prisma";
import { handler, HttpError, requireApiUser } from "@/lib/api/http";

type Ctx = { params: Promise<{ userId: string }> };

/** Serves a user's avatar as an image, so lists carry a short URL instead of a data URL per row. */
export const GET = handler(async (req: Request, { params }: Ctx) => {
  await requireApiUser();
  const { userId } = await params;
  const p = await prisma.profile.findUnique({ where: { userId }, select: { avatar: true, updatedAt: true } });
  const m = p?.avatar?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!p || !m) throw new HttpError(404, "Нет аватара");
  const etag = `"${userId}-${p.updatedAt.getTime()}"`;
  const headers = { "Cache-Control": "private, max-age=3600", ETag: etag, "X-Content-Type-Options": "nosniff" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(Buffer.from(m[2], "base64"), { headers: { ...headers, "Content-Type": m[1] } });
});
