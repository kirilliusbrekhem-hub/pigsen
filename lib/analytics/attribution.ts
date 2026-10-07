import "server-only";
import { prisma } from "@/lib/db/prisma";
import { parseUtmCookie, readCookie, UTM_COOKIE } from "./utm";

/** Saves first-touch attribution for a new user. Never throws. */
export async function saveAttribution(userId: string, req: Request, referred: boolean) {
  try {
    const utm = parseUtmCookie(readCookie(req.headers.get("cookie"), UTM_COOKIE));
    const data = utm ?? { source: "", medium: "", campaign: "", content: "", landing: "", referrer: "" };
    if (referred && !data.source) {
      data.source = "referral";
      data.medium = data.medium || "referral";
    }
    if (!data.source) {
      if (data.referrer) {
        try {
          data.source = new URL(data.referrer).hostname.replace(/^www\./, "").slice(0, 64);
          data.medium = data.medium || "referrer";
        } catch {
          data.source = "direct";
        }
      } else data.source = "direct";
    }
    await prisma.attribution.upsert({ where: { userId }, update: {}, create: { userId, ...data } });
  } catch (e) {
    console.error("[attribution] save failed", e);
  }
}
