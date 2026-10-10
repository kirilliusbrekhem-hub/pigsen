import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SaveScreen } from "@/components/kapital/Save";
import { requireUser } from "@/lib/auth/session";
import { getLang } from "@/lib/kapital/lang";
import { kapitalView } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Отложить" };

export default async function SavePage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const view = await kapitalView(user, { simulate: false });
  if (!view) redirect("/new");
  return <SaveScreen lang={lang} bizName={view.biz.name} capital={view.biz.capital} target={view.biz.target} streak={view.streak} />;
}
