export const UTM_COOKIE = "pigsen_utm";
export const VID_COOKIE = "pigsen_vid";
/** Short-lived, readable by JS: the server sets it after registration so the client can fire the "register" goal. */
export const GOAL_COOKIE = "pigsen_goal";

export interface Utm {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  landing: string;
  referrer: string;
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, n) : "");

export function normalizeUtm(raw: unknown): Utm {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    source: clip(o.source, 64).toLowerCase(),
    medium: clip(o.medium, 64).toLowerCase(),
    campaign: clip(o.campaign, 100),
    content: clip(o.content, 100),
    landing: clip(o.landing, 200),
    referrer: clip(o.referrer, 200),
  };
}

export function readCookie(header: string | null, name: string): string | null {
  const m = (header ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export function parseUtmCookie(value: string | null): Utm | null {
  if (!value) return null;
  try {
    return normalizeUtm(JSON.parse(value));
  } catch {
    return null;
  }
}
