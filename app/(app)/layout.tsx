import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/session";
import { countSaved } from "@/lib/content/saved";
import { isPro } from "@/lib/billing/plan";
import { isAdminEmail } from "@/lib/admin/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.profile?.onboarded) redirect("/onboarding");
  const savedCount = await countSaved(user.id);
  return (
    <AppShell user={{ name: user.name, avatar: user.profile.avatar, plan: isPro(user.profile) ? "pro" : "free", coins: user.profile.coins, admin: isAdminEmail(user.email) }} savedCount={savedCount}>
      {children}
    </AppShell>
  );
}
