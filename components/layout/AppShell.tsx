"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand, Pig, Wordmark } from "@/components/ui/Brand";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { Avatar } from "@/components/ui/Avatar";
import { DOCK_HINTS, NAV, SECTION_TITLES, TABS, sectionOf } from "./nav";
import { CrumbContext } from "./crumb";

interface ShellUser {
  name: string;
  avatar: string | null;
  plan: string;
}

export function AppShell({ user, savedCount, children }: { user: ShellUser; savedCount: number; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const section = sectionOf(pathname);
  const depth = section === "ai" ? 1 : pathname.split("/").filter(Boolean).length;
  const isAI = section === "ai";
  const dockRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [dock, setDock] = useState("");
  const [query, setQuery] = useState("");
  const [crumb, setCrumb] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dockRef.current && dockRef.current.offsetParent) dockRef.current.focus();
        else router.push("/ai");
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        if (searchRef.current && searchRef.current.offsetParent) searchRef.current.focus();
        else router.push("/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  function askDock(q: string) {
    const text = q.trim();
    if (!text) return;
    setDock("");
    router.push(`/ai?q=${encodeURIComponent(text)}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const active = (href: string) => sectionOf(href) === section;
  const today = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  const parentHref = "/" + pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  const title = SECTION_TITLES[section] ?? "PIGSEN";

  return (
    <CrumbContext.Provider value={setCrumb}>
    <div className="shell">
      <div className="app">
        <aside className="sidebar" aria-label="Основная навигация">
          <Link href="/dashboard" aria-label="PIGSEN, на главную">
            <Brand sub />
          </Link>
          <nav className="nav">
            {NAV.map((n) =>
              n.href === "/ai" ? (
                <Link key={n.href} href={n.href} className={`nav-item ai-item ${active(n.href) ? "is-active" : ""}`} aria-current={active(n.href) ? "page" : undefined}>
                  <Orb className="orb-sm" />
                  $PIG
                  <kbd>⌘K</kbd>
                </Link>
              ) : (
                <Link key={n.href} href={n.href} className={`nav-item ${active(n.href) ? "is-active" : ""}`} aria-current={active(n.href) ? "page" : undefined}>
                  <Icon name={n.icon} />
                  {n.label}
                  {n.href === "/saved" && savedCount > 0 && <span className="count">{savedCount}</span>}
                  {n.href === "/search" && <kbd>/</kbd>}
                </Link>
              ),
            )}
          </nav>
          <div className="side-foot">
            <div className="trust-note">
              <Icon name="shield" />
              <span>$PIG объясняет и подсказывает. Решения всегда остаются за вами.</span>
            </div>
            <Link href="/profile" className={`me ${section === "profile" ? "is-active" : ""}`}>
              <Avatar name={user.name} src={user.avatar} />
              <span style={{ textAlign: "left", minWidth: 0 }}>
                <b style={{ fontWeight: 540, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</b>
                <span className="muted" style={{ fontSize: 12 }}>
                  {user.plan === "free" ? "Free план" : `${user.plan} план`}
                </span>
              </span>
            </Link>
          </div>
        </aside>

        <div className="mainwrap">
          <header className="topbar">
            <div className="crumbs">
              {depth > 1 ? (
                <>
                  <Link className="link-btn" href={`/${section}`}>
                    {title}
                  </Link>
                  <Icon name="chevR" size="sm" />
                  <b style={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{crumb ?? "…"}</b>
                </>
              ) : (
                <b>{title}</b>
              )}
            </div>
            <div className="spacer" />
            {section !== "search" && (
              <form className="top-search" role="search" onSubmit={submitSearch}>
                <Icon name="search" />
                <input
                  ref={searchRef}
                  className="input"
                  placeholder="Поиск статей, книг, курсов..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Поиск по PIGSEN"
                  maxLength={120}
                />
                <kbd>/</kbd>
              </form>
            )}
            <span className="date-pill">{today}</span>
          </header>

          <header className="mtop">
            {depth > 1 ? (
              <Link className="back icon-btn" style={{ width: "auto", padding: "0 8px" }} href={parentHref}>
                <Icon name="back" />
                <span>{title}</span>
              </Link>
            ) : (
              <Link href="/dashboard" className="brand" aria-label="PIGSEN">
                <Pig />
                {section === "dashboard" ? <Wordmark /> : <span className="wordmark" style={{ letterSpacing: "-.01em" }}>{title}</span>}
              </Link>
            )}
            <div className="spacer" />
            <Link className="icon-btn" href="/search" aria-label="Поиск">
              <Icon name="search" />
            </Link>
            <Link href="/profile" aria-label="Профиль">
              <Avatar name={user.name} src={user.avatar} />
            </Link>
          </header>

          <main className="main" id="main">
            <div className={`page ${isAI ? "page-ai" : ""}`} key={isAI ? "ai" : pathname}>
              {children}
            </div>
          </main>

          {!isAI && (
            <div className="dock">
              <form
                className="dock-inner"
                onSubmit={(e) => {
                  e.preventDefault();
                  askDock(dock);
                }}
              >
                <Orb />
                <input ref={dockRef} value={dock} onChange={(e) => setDock(e.target.value)} placeholder="Спросите $PIG о бизнесе, деньгах, технологиях..." autoComplete="off" aria-label="Спросить $PIG" maxLength={4000} />
                <div className="dock-hints">
                  {(DOCK_HINTS[section] ?? []).map((h) => (
                    <button key={h} type="button" className="dock-hint" onClick={() => askDock(h)}>
                      {h}
                    </button>
                  ))}
                </div>
                <kbd>⌘K</kbd>
                <button className="send" type="submit" aria-label="Спросить" disabled={!dock.trim()}>
                  <Icon name="send" />
                </button>
              </form>
            </div>
          )}
        </div>

        <nav className="tabbar" aria-label="Основная навигация">
          {TABS.map((t) =>
            t.href === "/ai" ? (
              <Link key={t.href} href={t.href} className={`tb tb-ai ${active(t.href) ? "is-active" : ""}`} aria-label="Спросить $PIG">
                <span className="ai-btn">
                  <Orb />
                </span>
                <span>{t.label}</span>
              </Link>
            ) : (
              <Link key={t.href} href={t.href} className={`tb ${active(t.href) ? "is-active" : ""}`}>
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </Link>
            ),
          )}
        </nav>
      </div>
    </div>
    </CrumbContext.Provider>
  );
}
