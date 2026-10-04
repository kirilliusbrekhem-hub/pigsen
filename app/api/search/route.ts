import { enforceRateLimit, handler, HttpError, json, requireApiUser } from "@/lib/api/http";
import { search } from "@/lib/search/service";
import { searchQuerySchema } from "@/lib/validation/schemas";

export const GET = handler(async (req: Request) => {
  const user = await requireApiUser();
  enforceRateLimit(`search:${user.id}`, 60, 60_000);
  const parsed = searchQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new HttpError(422, "Введите запрос");
  const log = new URL(req.url).searchParams.get("preview") !== "1";
  return json(await search(user.id, parsed.data.q, parsed.data.type, log));
});
