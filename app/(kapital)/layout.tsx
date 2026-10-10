import { KapitalShell } from "@/components/kapital/Shell";
import { requireUser } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { prisma } from "@/lib/db/prisma";
import { getLang } from "@/lib/kapital/lang";
import { legacyTarget } from "@/lib/kapital/generate";

export default async function KapitalLayout({ children }: { children: React.ReactNode }) {
  const [user, lang] = await Promise.all([requireUser(), getLang()]);
  const m = await prisma.bizMember.findUnique({ where: { userId: user.id }, select: { business: { select: { name: true, capital: true, target: true, kind: true } } } });
  const b = m?.business;
  const target = b ? (b.target > 0 ? b.target : legacyTarget(b.kind)) : 0;
  const biz = b ? { name: b.name, initial: (b.name.trim().charAt(0) || "K").toUpperCase(), pct: Math.min(100, Math.floor((b.capital / target) * 100)) } : null;
  return (
    <KapitalShell lang={lang} biz={biz} pro={isPro(user.profile)}>
      {children}
    </KapitalShell>
  );
}
