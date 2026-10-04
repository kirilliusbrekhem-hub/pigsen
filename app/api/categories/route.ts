import { handler, json, requireApiUser } from "@/lib/api/http";
import { listCategories } from "@/lib/content/service";

export const GET = handler(async () => {
  await requireApiUser();
  return json({ categories: await listCategories() });
});
