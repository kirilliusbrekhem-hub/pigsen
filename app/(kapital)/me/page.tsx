import type { Metadata } from "next";
import { ProfileScreen } from "@/components/kapital/Profile";
import { requireUser } from "@/lib/auth/session";
import { getLang } from "@/lib/kapital/lang";
import { profileStats } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Профиль" };

export default async function MePage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const s = await profileStats(user);
  return <ProfileScreen lang={lang} data={{ name: user.name, saved: s.saved, streak: s.streak, rank: s.rank, bizName: s.bizName, badges: s.badges, tier: s.tier }} />;
}
