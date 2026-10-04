import "server-only";
import type { Profile } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AiTone, Theme } from "@/types";
import { AI_TONES, THEMES } from "@/types";

export function parseInterests(profile: Pick<Profile, "interests"> | null | undefined): string[] {
  if (!profile) return [];
  try {
    const v: unknown = JSON.parse(profile.interests);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function profileTheme(profile: Pick<Profile, "theme"> | null | undefined): Theme {
  return profile && (THEMES as readonly string[]).includes(profile.theme) ? (profile.theme as Theme) : "system";
}

export function profileTone(profile: Pick<Profile, "aiTone"> | null | undefined): AiTone {
  return profile && (AI_TONES as readonly string[]).includes(profile.aiTone) ? (profile.aiTone as AiTone) : "balanced";
}

export async function ensureProfile(userId: string) {
  return prisma.profile.upsert({ where: { userId }, update: {}, create: { userId } });
}

export interface ProfilePatch {
  name?: string;
  bio?: string;
  avatar?: string | null;
  interests?: string[];
  theme?: Theme;
  aiTone?: AiTone;
  dailyGoalMinutes?: number;
  notifyDigest?: boolean;
  notifyNewContent?: boolean;
}

export async function updateProfile(userId: string, patch: ProfilePatch) {
  const { name, interests, ...rest } = patch;
  let validInterests: string[] | undefined;
  if (interests) {
    const known = await prisma.category.findMany({ where: { slug: { in: interests } }, select: { slug: true } });
    validInterests = known.map((k) => k.slug);
  }
  await prisma.$transaction([
    ...(name ? [prisma.user.update({ where: { id: userId }, data: { name } })] : []),
    prisma.profile.upsert({
      where: { userId },
      update: { ...rest, ...(validInterests ? { interests: JSON.stringify(validInterests), onboarded: true } : {}) },
      create: { userId, ...rest, interests: JSON.stringify(validInterests ?? []), onboarded: Boolean(validInterests) },
    }),
  ]);
}
