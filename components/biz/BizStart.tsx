"use client";
// Onboarding for a user without a business, step 1–2 of 3: full-screen picker of business types grouped by category
// (each card shows that business's own scene) → name it. Step 3 (first deposit → first item) is FirstRun in BizApp.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { ACCENTS, GROUPS, KINDS, LOGOS, TEMPLATE_TITLES, type BizGroup, type BizKind } from "@/lib/biz/catalog";
import { Button, btnClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BizScene } from "./BizScene";

interface Kind {
  kind: string;
  title: string;
  blurb: string;
  available: boolean;
  levels: string[];
  template?: string;
  emoji?: string;
  group?: string;
}

/** A believable "few weeks in" scene for the preview card: the first cheap, unlocked items of that business. */
function previewOwned(kind: BizKind, n = 6) {
  return KINDS[kind].catalog
    .filter((x) => !x.premium && !x.exclusive && !x.minLevel)
    .slice(0, n)
    .map((x) => ({ itemId: x.id, status: "ok" }));
}

function Preview({ kind, rich = 6, guests = 14 }: { kind: BizKind; rich?: number; guests?: number }) {
  const owned = useMemo(() => previewOwned(kind, rich), [kind, rich]);
  const catalog = useMemo(() => KINDS[kind].catalog.filter((x) => owned.some((o) => o.itemId === x.id)).map((x) => ({ id: x.id, title: x.title, price: x.price, state: "owned", slot: x.slot })), [kind, owned]);
  return <BizScene owned={owned} level={1} guests={guests} name={KINDS[kind].title} kind={kind} kindTitle={KINDS[kind].title} catalog={catalog} />;
}

export function BizStart({ kinds, defaultName, hasGoals, pro = false }: { kinds: Kind[]; defaultName: string; hasGoals: boolean; pro?: boolean }) {
  const [kind, setKind] = useState<BizKind | null>(null);
  const firstName = defaultName.split(" ").slice(1).join(" ");
  const [name, setName] = useState(defaultName);
  const [custom, setCustom] = useState(false);
  const [emoji, setEmoji] = useState<string>(LOGOS[7]);
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function pick(k: BizKind) {
    setKind(k);
    setName(`${KINDS[k].title} ${firstName}`.trim().slice(0, 40));
    window.scrollTo({ top: 0 });
    document.querySelector(".bo-screen")?.scrollTo({ top: 0 });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/biz", { method: "POST", body: { kind, name, custom: custom && pro ? { emoji, accent } : null } });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!kind) {
    return (
      <div className="bo-screen" role="dialog" aria-modal="true" aria-labelledby="bo-title" data-testid="biz-picker">
        <div className="bo-inner">
          <header className="bo-top">
            <Link href="/dashboard" className="bo-close" aria-label="Закрыть">
              <Icon name="close" />
            </Link>
            <span className="bo-steps" aria-label="Шаг 1 из 3">
              <i className="is-on" />
              <i />
              <i />
            </span>
          </header>
          <span className="label">Мой бизнес · шаг 1 из 3</span>
          <h1 id="bo-title">Какой бизнес откроем?</h1>
          <p className="muted bo-lead">Капитал бизнеса — это ваши реальные накопления: каждый рубль в копилке становится рублём капитала. Выберите, что будете строить.</p>
          <nav className="bo-groups" aria-label="Категории">
            {GROUPS.map((g) => (
              <a key={g.id} href={`#bo-${g.id}`} className="chip">
                {g.title}
              </a>
            ))}
          </nav>
          {GROUPS.map((g) => (
            <section key={g.id} id={`bo-${g.id}`} className="bo-group">
              <div className="bo-group-head">
                <h2>{g.title}</h2>
                <span className="muted">{g.blurb}</span>
              </div>
              <div className="bo-cards">
                {kinds
                  .filter((k) => (k.group ?? KINDS[k.kind as BizKind]?.group) === (g.id as BizGroup))
                  .map((k) => (
                    <button type="button" key={k.kind} className="bo-card" disabled={!k.available} onClick={() => pick(k.kind as BizKind)} data-testid={`kind-${k.kind}`}>
                      <span className="bo-card-art" aria-hidden>
                        <Preview kind={k.kind as BizKind} />
                      </span>
                      <span className="bo-card-body">
                        <b>
                          <span aria-hidden>{k.emoji}</span> {k.title}
                        </b>
                        <span className="muted">{k.blurb}</span>
                        <span className="bo-ladder">{k.levels.join(" → ")}</span>
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  const k = KINDS[kind];
  return (
    <div className="bo-screen" role="dialog" aria-modal="true" aria-labelledby="bo-title" data-testid="biz-name-step">
      <form className="bo-inner" onSubmit={create}>
        <header className="bo-top">
          <button type="button" className="bo-close" onClick={() => setKind(null)} aria-label="Выбрать другой бизнес">
            <Icon name="back" />
          </button>
          <span className="bo-steps" aria-label="Шаг 2 из 3">
            <i className="is-done" />
            <i className="is-on" />
            <i />
          </span>
        </header>
        <span className="label">
          {k.emoji} {k.title} · шаг 2 из 3
        </span>
        <h1 id="bo-title">Как назовём?</h1>
        <div className="bo-hero card">
          <Preview kind={kind} rich={1} guests={6} />
        </div>
        <div className="field">
          <label htmlFor="biz-name">Название</label>
          <input id="biz-name" className="input bo-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <ol className="bo-path" aria-label="Путь бизнеса">
          {k.levels.map((l, i) => (
            <li key={l} className={i === 0 ? "is-on" : ""}>
              <b>{l}</b>
              <span className="muted">{i === 0 ? "старт" : i === 1 ? "4 ключевых улучшения" : "второй филиал"}</span>
            </li>
          ))}
        </ol>

        <div className={`card card-pad stack ${pro ? "" : "bg-locked"}`} style={{ gap: 10 }} data-testid="custom-biz">
          <div className="biz-sec-head">
            <b>Свой бизнес · Pro</b>
            {!pro && <Icon name="lock" size="sm" />}
          </div>
          <span className="muted biz-small">Шаблон — {k.title.toLowerCase()} ({TEMPLATE_TITLES[k.template]}), а логотип, оттенок и названия улучшений — ваши. Плюс премиум-предметы.</span>
          {pro ? (
            <>
              <label className="row biz-small" style={{ gap: 8 }}>
                <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} data-testid="custom-on" /> Сделать свой бизнес
              </label>
              {custom && (
                <>
                  <div className="bg-logos" role="radiogroup" aria-label="Логотип">
                    {LOGOS.map((x) => (
                      <button type="button" key={x} role="radio" aria-checked={emoji === x} className={emoji === x ? "is-on" : ""} onClick={() => setEmoji(x)}>
                        {x}
                      </button>
                    ))}
                  </div>
                  <div className="bg-accents" role="radiogroup" aria-label="Оттенок">
                    {ACCENTS.map((a) => (
                      <button type="button" key={a} role="radio" aria-checked={accent === a} aria-label={`Оттенок ${a}`} className={accent === a ? "is-on" : ""} style={{ background: a }} onClick={() => setAccent(a)} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <Link href="/pro" className={btnClass("secondary", "sm")}>
              <Icon name="lock" size="sm" /> Открыть в Pro
            </Link>
          )}
        </div>

        {!hasGoals && (
          <p className="biz-note muted">
            <Icon name="piggy" size="sm" /> Цель в копилке создадим на следующем шаге — взносы в неё станут капиталом.
          </p>
        )}
        {error && <p className="biz-error">{error}</p>}
        <div className="bo-cta">
          <Button variant="primary" size="lg" block loading={busy} type="submit">
            Открыть бизнес
          </Button>
        </div>
      </form>
    </div>
  );
}
