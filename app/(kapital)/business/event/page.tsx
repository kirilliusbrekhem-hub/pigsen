import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EventScreen } from "@/components/kapital/Event";
import { requireUser } from "@/lib/auth/session";
import { getLang } from "@/lib/kapital/lang";
import { kapitalView } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Событие дня" };

export default async function EventPage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const view = await kapitalView(user);
  if (!view) redirect("/new");
  return <EventScreen lang={lang} today={view.biz.event} crisis={view.biz.crisis} />;
}
