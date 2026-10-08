import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireUserWith } from "@/lib/auth/session";
import { countSaved } from "@/lib/content/saved";
import { tierOf } from "@/lib/billing/plan";
import { hasAdminGrant, isAdmin } from "@/lib/admin/auth";
import { avatarUrl } from "@/lib/profile/avatar-url";
import { profileTheme } from "@/lib/profile/service";
import { ThemeScript } from "@/components/layout/ThemeScript";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Saved count and the admin grant load alongside the account check (one DB round trip, not two).
  const [user, [savedCount]] = await requireUserWith((userId) => Promise.all([countSaved(userId), hasAdminGrant(userId)]));
  if (!user.profile?.onboarded) redirect("/onboarding");
  const admin = await isAdmin(user); // cached grant lookup; only the first-admin bootstrap queries again
  return (
    <>
    <ThemeScript theme={profileTheme(user.profile)} />
    <AppShell user={{ name: user.name, avatar: avatarUrl(user.id, user.profile), plan: tierOf(user.profile), title: user.profile.title, coins: user.profile.coins, admin }} savedCount={savedCount}>
      {children}
    </AppShell>
    </>
  );
}
