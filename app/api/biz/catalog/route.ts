import { json } from "@/lib/api/http";
import { CATALOG } from "@/lib/biz/catalog";

/** Static catalog of business types and item ids (for the scene renderer and tools). */
export const GET = () => json({ types: CATALOG });
