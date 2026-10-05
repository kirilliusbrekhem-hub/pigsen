import { z } from "zod";
import { handler, json, requireApiUser } from "@/lib/api/http";
import { paymentStatus } from "@/lib/billing/telegram";

export const GET = handler(async (req: Request) => {
  const user = await requireApiUser();
  const id = z.string().max(60).parse(new URL(req.url).searchParams.get("id") ?? "");
  return json({ status: await paymentStatus(user.id, id) });
});
