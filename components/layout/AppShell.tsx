"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Brand, Pig, Wordmark } from "@/components/ui/Brand";
import { Coin } from "@/components/ui/Coin";
import { Icon } from "@/components/ui/Icon";
import { Orb } from "@/components/ui/Orb";
import { Avatar } from "@/components/ui/Avatar";
import { ADMIN_ITEM, DOCK_HINTS, NAV_TREE, SECTION_TITLES, TABS, isGroup, sectionOf, type NavGroup, type NavItem } from "./nav";
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
  const [dock, setDock] = useState("");
  const [crumb, setCrumb] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const navTree = user.admin ? [...NAV_TREE, ADMIN_ITEM] : NAV_TREE;
  const navGroups = navTree.filter(isGroup);
  const moreTop: NavItem[] = [
    ...navTree.filter((e): e is NavItem => !isGroup(e) && !TABS.some((t) => t.href === e.href)),
    { href: "/profile", label: "Профиль", icon: "user" },
  ];
  const moreItems: NavItem[] = [...navGroups.flatMap((g) => g.items), ...moreTop];
  const groupHas = (g: NavGroup, sec: string) => g.items.some((i) => i.href !== "/biz/top" && sectionOf(i.href) === sec);

  // Collapsible sidebar groups: default / stored state, auto-open for the current route.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_TREE.filter(isGroup).map((g) => [g.id, !!g.defaultOpen || groupHas(g, section)])),
  );
  const [openPath, setOpenPath] = useState(pathname);
  if (openPath !== pathname) {
    setOpenPath(pathname);
    const g = navGroups.find((x) => groupHas(x, section));
    if (g && !open[g.id]) setOpen({ ...open, [g.id]: true });
  }
  useEffect(() => {
    let stored: Record<string, boolean> | null = null;
    try {
      stored = JSON.parse(localStorage.getItem("pigsen.nav.groups") || "null");
    } catch {}
    if (!stored || typeof stored !== "object") return;
    const s = stored;
    const sec = sectionOf(window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
    setOpen((prev) => {
      const next = { ...prev };
      for (const g of NAV_TREE.filter(isGroup)) {
        if (typeof s[g.id] === "boolean") next[g.id] = s[g.id] || groupHas(g, sec);
      }
      return next;
    });
  }, []);
  function toggleGroup(id: string) {
    const next = { ...open, [id]: !open[id] };
    setOpen(next);
    try {
      localStorage.setItem("pigsen.nav.groups", JSON.stringify(next));
    } catch {}
  }

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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dockRef.current && dockRef.current.offsetParent) dockRef.current.focus();
        else router.push("/ai");
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

  const active = (href: string) =>
    href === "/biz/top" ? pathname.startsWith("/biz/top") : href === "/biz" ? section === "biz" && !pathname.startsWith("/biz/top") : sectionOf(href) === section;

  function badges(href: string) {
    return (
      <>
        {href === "/saved" && savedCount > 0 && <span className="count">{savedCount}</span>}
        {href === "/messages" && unread > 0 && <span className="count dm-count">{unread}</span>}
      </>
    );
  }

  function renderLink(n: NavItem, sub = false) {
    const on = active(n.href);
    if (n.href === "/ai")
      return (
        <Link key={n.href} href={n.href} className={`nav-item ai-item ${on ? "is-active" : ""}`} aria-current={on ? "page" : undefined}>
          <Orb className="orb-sm" />
          CAP
          <kbd>⌘K</kbd>
        </Link>
      );
    return (
      <Link key={n.href} href={n.href} className={`nav-item ${sub ? "nav-sub" : ""} ${on ? "is-active" : ""}`} aria-current={on ? "page" : undefined}>
        {!sub && <Icon name={n.icon} />}
        {n.label}
        {badges(n.href)}
      </Link>
    );
  }

  function moreLink(m: NavItem) {
    return (
      <Link key={m.href} href={m.href} className={`more-item ${active(m.href) ? "is-active" : ""}`}>
        <Icon name={m.icon} />
        <span>{m.label}</span>
        {badges(m.href)}
      </Link>
    );
  }
  const today = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  const parentHref = "/" + pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  const title = SECTION_TITLES[section] ?? "Kapital";

  return (
    <CrumbContext.Provider value={setCrumb}>
    <div className="shell">
      <div className="app">
        <aside className="sidebar" aria-label="Основная навигация">
          <Link href="/business" aria-label="Kapital, к бизнесу">
            <Brand sub />
          </Link>
          <nav className="nav">
            {navTree.map((e) => {
              if (!isGroup(e)) return renderLink(e);
              const isOpen = !!open[e.id];
              const hasActive = groupHas(e, section);
              const dot = e.items.some((i) => i.href === "/messages") && unread > 0;
              return (
                <div key={e.id} className={`nav-group ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className={`nav-item nav-group-head ${hasActive && !isOpen ? "has-active" : ""}`}
                    aria-expanded={isOpen}
                    aria-controls={`nav-g-${e.id}`}
                    onClick={() => toggleGroup(e.id)}
                  >
                    <Icon name={e.icon} />
                    {e.label}
                    {dot && <span className="nav-dot" aria-label="Есть непрочитанные" />}
                    <Icon name="chev" size="sm" className="nav-chev" />
                  </button>
                  <div className="nav-group-body" id={`nav-g-${e.id}`} inert={!isOpen}>
                    <div className="nav-group-inner">
                      {e.sections
                        ? e.sections.map((sec) => (
                            <div key={sec.label} className="nav-sec" role="group" aria-label={sec.label}>
                              <span className="nav-sec-h" aria-hidden="true">{sec.label}</span>
                              {sec.items.map((i) => renderLink(i, true))}
                            </div>
                          ))
                        : e.items.map((i) => renderLink(i, true))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="side-foot">
            {user.plan !== "pro" && (
              <Link href="/plans" className="btn btn-accent btn-sm btn-block" data-testid="side-pro">
                <Icon name="sparkle" size="sm" /> {user.plan === "lite" ? "Пробный Pro: перейти на полный" : "Перейти на Pro"}
              </Link>
            )}
            <div className="trust-note">
              <Icon name="shield" />
              <span>CAP объясняет и подсказывает. Решения всегда остаются за вами.</span>
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
                <span className="muted" style={{ fontSize: 12 }} data-fx-target="coins">
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
            <span className="date-pill">{today}</span>
          </header>

          <header className="mtop">
            {depth > 1 ? (
              <Link className="back icon-btn" style={{ width: "auto", padding: "0 8px" }} href={parentHref}>
                <Icon name="back" />
                <span>{title}</span>
              </Link>
            ) : (
              <Link href="/business" className="brand" aria-label="Kapital">
                <Pig />
                {section === "dashboard" ? <Wordmark /> : <span className="wordmark" style={{ letterSpacing: "-.01em" }}>{title}</span>}
              </Link>
            )}
            <div className="spacer" />
            <Link href="/profile" aria-label="Профиль" data-fx-target="coins">
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
                <input ref={dockRef} value={dock} onChange={(e) => setDock(e.target.value)} placeholder="Спросите CAP о бизнесе, деньгах, технологиях..." autoComplete="off" aria-label="Спросить CAP" maxLength={4000} />
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
              <Link key={t.href} href={t.href} className={`tb tb-ai ${active(t.href) ? "is-active" : ""}`} aria-label="Спросить CAP">
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
                {navGroups
                  .flatMap((g) => g.sections?.map((sec, i) => ({ id: `${g.id}-${i}`, ...sec })) ?? [{ id: g.id, label: g.label, items: g.items }])
                  .map((g) => (
                    <section key={g.id} className="more-sec" aria-labelledby={`more-h-${g.id}`}>
                      <h3 className="more-h" id={`more-h-${g.id}`}>{g.label}</h3>
                      <div className="more-grid">{g.items.map(moreLink)}</div>
                    </section>
                  ))}
                <section className="more-sec" aria-labelledby="more-h-etc">
                  <h3 className="more-h" id="more-h-etc">Аккаунт</h3>
                  <div className="more-grid">{moreTop.map(moreLink)}</div>
                </section>
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
