import "server-only";
import type { ZodTypeAny, z } from "zod";
import { HttpError, parseBody } from "@/lib/api/http";

export const MAX_BODY = 64 * 1024;

/** parseBody with a hard size cap: rejects by Content-Length first, then by the actual byte count. */
export async function parseLimited<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) throw new HttpError(413, "Слишком большой запрос");
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY) throw new HttpError(413, "Слишком большой запрос");
  return parseBody(new Request(req.url, { method: "POST", body: raw, headers: { "content-type": "application/json" } }), schema);
}
