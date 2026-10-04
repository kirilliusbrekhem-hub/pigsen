import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pig, Wordmark } from "@/components/ui/Brand";
import { Onboarding } from "@/components/profile/Onboarding";
import { requireUser } from "@/lib/auth/session";
import { listCategories } from "@/lib/content/service";
import { parseInterests } from "@/lib/profile/service";

export const metadata: Metadata = { title: "Интересы" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile?.onboarded) redirect("/dashboard");
  const cats = await listCategories();
  return (
    <div className="landing">
      <header>
        <div className="brand">
          <Pig />
          <Wordmark />
        </div>
      </header>
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 16px 56px" }}>
        <Onboarding name={user.name.split(" ")[0]} options={cats.map((c) => ({ slug: c.slug, name: c.name, description: c.description, icon: c.icon }))} initial={parseInterests(user.profile)} />
      </div>
    </div>
  );
}
