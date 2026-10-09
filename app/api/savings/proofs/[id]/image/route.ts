import { handler, HttpError } from "@/lib/api/http";
import { requireApiAdmin } from "@/lib/admin/auth";
import { proofImage } from "@/lib/savings/proof";

/** The screenshot is visible to reviewers only («скрин видит только проверка»). */
export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireApiAdmin();
  const { id } = await params;
  const p = await proofImage(id.slice(0, 64));
  if (!p?.image) throw new HttpError(404, "Скриншот удалён или не найден");
  return new Response(new Uint8Array(p.image), {
    headers: { "Content-Type": p.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" },
  });
});
