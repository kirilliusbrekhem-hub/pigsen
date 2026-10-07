"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand, Pig, Wordmark } from "@/components/ui/Brand";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { Avatar } from "@/components/ui/Avatar";
import { DOCK_HINTS, NAV, SECTION_TITLES, TABS, sectionOf } from "./nav";
import { CrumbContext } from "./crumb";

interface ShellUser {
  name: string;
  avatar: string | null;
  plan: string;
  coins: number;
  title?: string;
  admin?: boolean;
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
  const [more, setMore] = useState(false);
  const navItems = user.admin ? [...NAV, { href: "/admin", label: "Админка", icon: "shield" }] : NAV;
  const moreItems = [...navItems.filter((n) => !TABS.some((t) => t.href === n.href)), { href: "/profile", label: "Профиль", icon: "user" }];

  // Close the mobile menu on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMore(false);
  }

  // Unread private messages badge (polls every 30s while the tab is visible).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/dm/unread", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { unread?: number } | null) => { if (alive && d) setUnread(d.unread ?? 0); })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [pathname]);

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
            {navItems.map((n) =>
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
                  {n.href === "/messages" && unread > 0 && <span className="count dm-count">{unread}</span>}
                  {n.href === "/search" && <kbd>/</kbd>}
                </Link>
              ),
            )}
          </nav>
          <div className="side-foot">
            {user.plan !== "pro" && (
              <Link href="/pro" className="btn btn-accent btn-sm btn-block" data-testid="side-pro">
                <Icon name="sparkle" size="sm" /> {user.plan === "lite" ? "Пробный Pro: перейти на полный" : "Перейти на Pro"}
              </Link>
            )}
            <div className="trust-note">
              <Icon name="shield" />
              <span>$PIG объясняет и подсказывает. Решения всегда остаются за вами.</span>
            </div>
            <nav className="site-legal" aria-label="Документы">
              <Link href="/terms">Условия</Link>
              <Link href="/privacy">Конфиденциальность</Link>
              <Link href="/offer">Оплата и возвраты</Link>
              <Link href="/rules">Правила</Link>
            </nav>
            <Link href="/profile" className={`me ${section === "profile" ? "is-active" : ""}`}>
              <Avatar name={user.name} src={user.avatar} />
              <span style={{ textAlign: "left", minWidth: 0 }}>
                <b style={{ fontWeight: 540, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</b>
                <span className="muted" style={{ fontSize: 12 }}>
                  {user.plan === "pro" ? <span className="pro-badge">Pro</span> : user.plan === "lite" ? "Пробный Pro" : "Free"} · {user.coins} <Coin size={12} />
                </span>
                {user.title && <span className="title-chip">{user.title}</span>}
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
          <button type="button" className={`tb ${more || moreItems.some((m) => active(m.href)) ? "is-active" : ""}`} onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}>
            <Icon name="grid" />
            <span>Ещё</span>
          </button>
        </nav>

      </div>
        {more && (
          <div className="overlay sheet-menu" role="dialog" aria-modal="true" aria-label="Все разделы">
            <div className="scrim" onClick={() => setMore(false)} />
            <div className="modal">
              <div className="sheet-grab" />
              <div className="modal-head">
                <h2>Все разделы</h2>
                <button className="icon-btn" onClick={() => setMore(false)} aria-label="Закрыть">
                  <Icon name="close" />
                </button>
              </div>
              <div className="modal-body">
                <div className="more-grid">
                  {moreItems.map((m) => (
                    <Link key={m.href} href={m.href} className={`more-item ${active(m.href) ? "is-active" : ""}`}>
                      <Icon name={m.icon} />
                      <span>{m.label}</span>
                      {m.href === "/saved" && savedCount > 0 && <span className="count">{savedCount}</span>}
                      {m.href === "/messages" && unread > 0 && <span className="count dm-count">{unread}</span>}
                    </Link>
                  ))}
                </div>
                <div className="more-foot muted">
                  {user.plan === "pro" ? <span className="pro-badge">Pro</span> : user.plan === "lite" ? "Пробный Pro" : <Link href="/pro">Free · перейти на Pro</Link>} · {user.coins} <Coin size={14} /> PigCoin$
                </div>
                <nav className="site-legal" aria-label="Документы" style={{ justifyContent: "center", marginTop: 10 }}>
                  <Link href="/terms">Условия</Link>
                  <Link href="/privacy">Конфиденциальность</Link>
                  <Link href="/offer">Оплата</Link>
                  <Link href="/rules">Правила</Link>
                </nav>
              </div>
            </div>
          </div>
        )}
    </div>
    </CrumbContext.Provider>
  );
}
