import { handler, requireApiUser } from "@/lib/api/http";
import { isAdmin } from "@/lib/admin/auth";
import { decodeGoalImage } from "@/lib/savings/image";
import { proofImage } from "@/lib/biz/proofs";

type Ctx = { params: Promise<{ id: string }> };

/** A challenge proof photo: visible to its author and admins only. */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const img = await proofImage(id.slice(0, 64), { id: user.id, admin: await isAdmin(user) });
  const d = img ? decodeGoalImage(img) : null;
  if (!d) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(d.body), { headers: { "Content-Type": d.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
