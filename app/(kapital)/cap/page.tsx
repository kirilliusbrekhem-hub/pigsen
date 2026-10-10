import type { Metadata } from "next";
import { CapChat } from "@/components/kapital/CapChat";
import { requireUser } from "@/lib/auth/session";
import { dictFor } from "@/lib/kapital/i18n";
import { getLang } from "@/lib/kapital/lang";
import { kapitalView } from "@/lib/kapital/service";

export const metadata: Metadata = { title: "CAP" };

export default async function CapPage() {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const view = await kapitalView(user, { simulate: false });
  const t = dictFor(lang);
  const greeting = view ? t.capGreeting(view.biz.name, view.biz.pct, view.streak) : lang === "en" ? "Hi! I’m CAP, your AI co-founder. Describe a business and I’ll build it with you." : "Привет! Я CAP, твой ИИ-сооснователь. Опиши бизнес, и соберём его вместе.";
  return (
    <div className="kp-cap">
      <CapChat lang={lang} bizName={view?.biz.name ?? null} greeting={greeting} />
    </div>
  );
}
