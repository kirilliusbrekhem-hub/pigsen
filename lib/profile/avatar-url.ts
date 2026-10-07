/** Public URL of a user's avatar (served by /api/avatar/[userId]); `v` busts the cache when the profile changes. */
export function avatarUrl(userId: string, profile: { avatar: string | null; updatedAt: Date } | null | undefined): string | null {
  return profile?.avatar ? `/api/avatar/${userId}?v=${profile.updatedAt.getTime()}` : null;
}
