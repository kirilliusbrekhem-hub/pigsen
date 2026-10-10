import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TeamScreen } from "@/components/kapital/Team";
import { requireUser } from "@/lib/auth/session";
import { getLang } from "@/lib/kapital/lang";
import { kapitalView } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Команда" };

export default async function TeamPage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const view = await kapitalView(user, { simulate: false });
  if (!view) redirect("/new");
  return <TeamScreen lang={lang} view={view} />;
}
