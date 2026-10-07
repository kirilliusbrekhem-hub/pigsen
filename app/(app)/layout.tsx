import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/session";
import { countSaved } from "@/lib/content/saved";
import { tierOf } from "@/lib/billing/plan";
import { isAdmin } from "@/lib/admin/auth";
import { avatarUrl } from "@/lib/profile/avatar-url";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.profile?.onboarded) redirect("/onboarding");
  const savedCount = await countSaved(user.id);
  return (
    <AppShell user={{ name: user.name, avatar: avatarUrl(user.id, user.profile), plan: tierOf(user.profile), title: user.profile.title, coins: user.profile.coins, admin: await isAdmin(user) }} savedCount={savedCount}>
      {children}
    </AppShell>
  );
}
