import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BusinessScreen } from "@/components/kapital/Business";
import { requireUser } from "@/lib/auth/session";
import { dictFor } from "@/lib/kapital/i18n";
import { getLang } from "@/lib/kapital/lang";
import { kapitalView } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "Мой бизнес" };

export default async function BusinessPage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const view = await kapitalView(user);
  if (!view) redirect("/new");
  const t = dictFor(lang);
  return <BusinessScreen lang={lang} view={view} greeting={t.capGreeting(view.biz.name, view.biz.pct, view.streak)} />;
}
