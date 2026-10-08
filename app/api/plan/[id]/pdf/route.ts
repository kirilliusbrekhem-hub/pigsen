import { HttpError, handler, requireApiUser } from "@/lib/api/http";
import { enforceDbRateLimit } from "@/lib/api/rate-limit-db";
import { renderPlanPdf } from "@/lib/bizplan/pdf";
import { getPlan, planPro } from "@/lib/bizplan/service";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{1,40}$/i.test(id)) throw new HttpError(404, "План не найден");
  await enforceDbRateLimit(`bizplan:pdf:${user.id}`, 20, 10 * 60_000);
  const plan = await getPlan(user.id, id);
  if (!plan) throw new HttpError(404, "План не найден");
  const bytes = await renderPlanPdf(plan, { watermark: !planPro(user) });
  const ascii = plan.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "plan";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pigsen-${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(`Бизнес-план ${plan.title}`)}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
});
