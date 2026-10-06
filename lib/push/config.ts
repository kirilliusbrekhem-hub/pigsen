import "server-only";

/** VAPID public key, or null when push is not configured (UI then hides push controls). */
export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PUBLIC_KEY : null;
}
