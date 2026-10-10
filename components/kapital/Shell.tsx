"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { dictFor, type Lang } from "@/lib/kapital/i18n";
import { Brand, TabIcon } from "./Art";

const TABS = [
  { href: "/business", icon: "biz", key: "tabBiz" },
  { href: "/cap", icon: "cap", key: "tabCap" },
  { href: "/team", icon: "team", key: "tabTeam" },
  { href: "/me", icon: "profile", key: "tabProfile" },
] as const;

/** Screens that show the bottom tab bar on phones (the rest are focused full-screen steps, as in the prototype). */
const WITH_TABS = new Set(["/business", "/cap", "/team", "/me"]);

export interface ShellBiz {
  name: string;
  initial: string;
  pct: number;
}

export function KapitalShell({ lang, biz, pro, children }: { lang: Lang; biz: ShellBiz | null; pro: boolean; children: ReactNode }) {
  const t = dictFor(lang);
  const path = usePathname();
  const tabs = WITH_TABS.has(path);
  const on = (href: string) => (href === "/business" ? path === "/business" || path === "/new" : path.startsWith(href));
  return (
    <div className={`kp kp-shell ${tabs ? "kp-has-tabs" : ""}`}>
      <aside className="kp-rail" aria-label={t.navLabel}>
        <Brand href="/business" size={36} />
        <div>
          <div className="rail-h">{t.myBusinesses}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {biz && (
              <Link href="/business" className={`rail-biz ${path.startsWith("/business") ? "on" : ""}`}>
                <span className="av">{biz.initial}</span>
                <span>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{biz.name}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--k-muted)" }}>{t.capitalPct(biz.pct)}</span>
                </span>
              </Link>
            )}
            {!biz && (
              <Link href="/new" className={`rail-biz add ${path === "/new" ? "on" : ""}`}>
                <span className="av">+</span>
                {t.newBiz}
              </Link>
            )}
          </div>
        </div>
        <nav className="rail-nav" aria-label={t.navLabel}>
          {TABS.map((x) => (
            <Link key={x.href} href={x.href} aria-current={on(x.href) ? "page" : undefined}>
              <TabIcon name={x.icon} on={on(x.href)} />
              {t[x.key]}
            </Link>
          ))}
        </nav>
        {!pro && (
          <Link href="/plans" className="rail-pro">
            <div className="serif" style={{ fontSize: 20 }}>Pro</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{t.proCard}</div>
            <div style={{ fontWeight: 800, marginTop: 8 }}>250 ★ / {t.perMonth}</div>
          </Link>
        )}
      </aside>
      <div className="kp-main">{children}</div>
      {tabs && (
        <nav className="kp-tabs" aria-label={t.navLabel}>
          {TABS.map((x) => (
            <Link key={x.href} href={x.href} aria-current={on(x.href) ? "page" : undefined}>
              <TabIcon name={x.icon} on={on(x.href)} />
              {t[x.key]}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
