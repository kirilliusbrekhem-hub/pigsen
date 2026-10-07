// Edge-safe session token helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "pigsen_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short. Set it in .env");
  }
  return new TextEncoder().encode(secret);
}

/** `sv` is the user's sessionVersion; bumping it in the DB revokes every older token. */
export async function signSession(userId: string, sessionVersion = 0): Promise<string> {
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionClaims(token: string | undefined): Promise<{ userId: string; sessionVersion: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, sessionVersion: typeof payload.sv === "number" ? payload.sv : 0 };
  } catch {
    return null;
  }
}

/** Signature/expiry check only (edge proxy); getCurrentUser also checks the session version. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  return (await verifySessionClaims(token))?.userId ?? null;
}
