import "server-only";
import { isPro } from "@/lib/billing/plan";

/**
 * CAP has two modes by plan:
 * - "edu" (Free, Lite): an educational assistant — explains topics and answers questions, no persona, no proactive ideas,
 *   no game strategy.
 * - "partner" (any Pro tier): a business partner/co-founder — proactive ideas, game strategy, a human-like persona,
 *   presence in the team chat and daily "come back tomorrow" hooks.
 * Real-money talk stays educational with disclaimers in both modes.
 */
export type PigMode = "edu" | "partner";

export const pigModeOf = (profile: { proUntil: Date | null } | null | undefined): PigMode => (isPro(profile) ? "partner" : "edu");

export const PIG_PARTNER_LOCK = "CAP-партнёр доступен в Pro";
