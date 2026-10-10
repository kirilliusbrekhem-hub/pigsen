"use client";
// Kapital game panels: crisis, story, investors, business switching, Pro custom skin and admin-reviewed challenges.
// All numbers come from the server view; actions go through the `act` helper of BizApp.

import { useRef, useState } from "react";
import Link from "next/link";
import type { BizView } from "@/lib/biz/service";
import { BIZ_KIND_IDS, KINDS, TEMPLATE_TITLES, type BizKind } from "@/lib/biz/catalog";
import { rub } from "@/lib/client/format";
import { Button, btnClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { fileToGoalImage } from "@/components/savings/GoalImage";

export type Act = <T extends { view?: BizView }>(key: string, path: string, body?: unknown, ok?: (r: T) => string | null) => Promise<T | null>;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const dateRu = (iso: string) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function CrisisCard({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const c = view.crisis;
  if (!c) return null;
  return (
    <section className="card card-pad stack bg-crisis" style={{ gap: 10 }} data-testid="biz-crisis">
      <div className="biz-sec-head">
        <h2>
          <Icon name="sparkle" size="sm" /> Кризис: {c.title}
        </h2>
        <span className="muted biz-small">день {c.day} · решите за 3 дня, иначе всё решится само — и плохо</span>
      </div>
      <p style={{ margin: 0 }}>{c.text}</p>
      {view.pigPartner && <p className="biz-small bg-pigsay">CAP: {c.pig}</p>}
      <div className="bg-opts">
        {c.options.map((o) => (
          <Button
            key={o.id}
            size="sm"
            variant="secondary"
            disabled={!o.affordable || !!busy}
            loading={busy === `crisis-${o.id}`}
            data-testid={`crisis-${o.id}`}
            onClick={() =>
              act<{ view: BizView; outcome: { good: boolean; text: string } }>(`crisis-${o.id}`, "/api/biz/crisis", { crisisId: c.id, optionId: o.id }, (r) => `${r.outcome.good ? "Удалось" : "Не повезло"}: ${r.outcome.text}`)
            }
          >
            {o.label} <span className="muted">· шанс {o.chance}%</span>
          </Button>
        ))}
      </div>
    </section>
  );
}

export function StoryPanel({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const cur = view.story.find((c) => c.status === "current" || c.status === "ready");
  const done = view.story.filter((c) => c.status === "done").length;
  return (
    <section className="card card-pad stack" style={{ gap: 10 }} data-testid="biz-story">
      <div className="biz-sec-head">
        <h2>История · {view.business.kindTitle}</h2>
        <span className="muted biz-small">
          глав пройдено: {done} из {view.story.length}
        </span>
      </div>
      <ol className="bg-chapters">
        {view.story.map((c) => (
          <li key={c.n} className={`is-${c.status}`} title={c.title}>
            <span>{c.status === "done" ? <Icon name="check" size="sm" /> : c.n}</span>
          </li>
        ))}
      </ol>
      {cur ? (
        <div className="bg-chapter" data-testid={`story-ch-${cur.n}`}>
          <b>
            Глава {cur.n}. {cur.title}
          </b>
          <p className="muted">{cur.text}</p>
          <span className="biz-small">
            {cur.goalText}: {cur.target === 4 && cur.goalText.startsWith("Рейтинг") ? `${view.business.rating.toFixed(2)} из ${cur.target}` : `${Math.floor(cur.progress).toLocaleString("ru-RU")} из ${cur.target.toLocaleString("ru-RU")}`}
          </span>
          <span className="biz-bar">
            <i style={{ width: `${Math.min(100, Math.round((cur.progress / cur.target) * 100))}%` }} />
          </span>
          <div className="biz-up-foot">
            <span className="biz-small">
              Награда: +{cur.coins} PigCoin$ и +{cur.xp} XP каждому
            </span>
            <Button size="sm" variant="accent" disabled={cur.status !== "ready"} loading={busy === "story"} data-testid="story-claim" onClick={() => act<{ view: BizView; coins: number; chapter: number }>("story", "/api/biz/story", {}, (r) => `Глава ${r.chapter} пройдена${r.coins ? `: +${r.coins} PigCoin$` : ""}`)}>
              {cur.status === "ready" ? "Завершить главу" : "В процессе"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="muted">История пройдена! Вы построили настоящий бизнес из накоплений.</p>
      )}
    </section>
  );
}

export function InvestorsPanel({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const { offers, deal, history } = view.investors;
  const b = view.business;
  return (
    <section className="card card-pad stack" style={{ gap: 10 }} data-testid="biz-investors">
      <div className="biz-sec-head">
        <h2>Инвесторы</h2>
        <span className="muted biz-small">
          репутация {b.reputation}/100{b.equity ? ` · доля инвесторов ${pct(b.equity)}` : ""}
          {b.boost.mult > 1 ? ` · ×${b.boost.mult} посетителей` : ""}
          {b.boost.discount ? ` · −${pct(b.boost.discount)} к ценам` : ""}
        </span>
      </div>
      <p className="muted biz-small" style={{ margin: 0 }}>
        Инвесторы не дают денег: капитал — только ваши накопления. Они ставят условия по копилке и дают игровой буст за долю игровой прибыли.
      </p>
      {deal && (
        <div className={`bg-deal is-${deal.progress.status}`} data-testid="biz-deal">
          <b>
            {deal.avatar} {deal.name}
          </b>
          <span className="biz-small">{deal.goal}</span>
          <span className="biz-bar">
            <i style={{ width: `${Math.min(100, Math.round((deal.progress.done / Math.max(1, deal.progress.total)) * 100))}%` }} />
          </span>
          <span className="biz-small">
            {deal.progress.label} · до {dateRu(deal.deadline)}
          </span>
          <span className="biz-small muted">Награда: {deal.reward}</span>
        </div>
      )}
      {offers.map((o) => (
        <div key={o.id} className="bg-offer" data-testid={`offer-${o.id}`}>
          <span className="bg-ava" aria-hidden>
            {o.avatar}
          </span>
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <b>{o.name}</b>
            <span className="muted biz-small">{o.personality}</span>
            <span className="biz-small">«{o.pitch}»</span>
            <span className="biz-small">
              <b>Условие:</b> {o.goal} · срок {o.deadlineDays} дн.
            </span>
            <span className="biz-small">
              <b>Награда:</b> {o.reward}
            </span>
            <span className="muted biz-small">Провал сделки: репутация −15, рейтинг −0.2</span>
            {b.isFounder ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button size="sm" variant="accent" loading={busy === `inv-${o.id}`} disabled={!!busy} onClick={() => act(`inv-${o.id}`, "/api/biz/investors", { investorId: o.id, action: "accept" }, () => `Сделка с ${o.name} заключена`)}>
                  Принять
                </Button>
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(`inv-${o.id}-no`, "/api/biz/investors", { investorId: o.id, action: "decline" }, () => "Вы отказались")}>
                  Отказаться
                </Button>
              </div>
            ) : (
              <span className="muted biz-small">Решение принимает основатель</span>
            )}
          </div>
        </div>
      ))}
      {!deal && !offers.length && <p className="muted biz-small">Сейчас предложений нет — инвесторы приходят с ростом дней и репутации.</p>}
      {history.length > 0 && (
        <p className="muted biz-small" style={{ margin: 0 }}>
          История: {history.map((h) => `${h.name} — ${h.status === "won" ? "сделка закрыта" : h.status === "failed" ? "сорвалась" : "отказ"}`).join(" · ")}
        </p>
      )}
    </section>
  );
}

/** Logo + accent picker and item renames (Pro). Free sees a locked preview. */
function CustomFields({ value, onChange, view, kind }: { value: { emoji: string; accent: string; names: Record<string, string> }; onChange: (v: { emoji: string; accent: string; names: Record<string, string> }) => void; view: Pick<BizView, "customOptions">; kind: BizKind }) {
  const [item, setItem] = useState(KINDS[kind].catalog[0]?.id ?? "");
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="bg-logos" role="radiogroup" aria-label="Логотип">
        {view.customOptions.logos.map((e) => (
          <button type="button" key={e} role="radio" aria-checked={value.emoji === e} className={value.emoji === e ? "is-on" : ""} onClick={() => onChange({ ...value, emoji: e })}>
            {e}
          </button>
        ))}
      </div>
      <div className="bg-accents" role="radiogroup" aria-label="Оттенок">
        {view.customOptions.accents.map((a) => (
          <button type="button" key={a} role="radio" aria-checked={value.accent === a} aria-label={`Оттенок ${a}`} className={value.accent === a ? "is-on" : ""} style={{ background: a }} onClick={() => onChange({ ...value, accent: a })} />
        ))}
      </div>
      <div className="bg-rename">
        <select className="input" value={item} onChange={(e) => setItem(e.target.value)} aria-label="Улучшение">
          {KINDS[kind].catalog.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </select>
        <input className="input" maxLength={30} placeholder="Своё название" value={value.names[item] ?? ""} aria-label="Своё название улучшения" onChange={(e) => onChange({ ...value, names: { ...value.names, [item]: e.target.value } })} />
      </div>
    </div>
  );
}

const DEFAULT_CUSTOM = (logos: readonly string[], accents: readonly string[]) => ({ emoji: logos[0] ?? "🌱", accent: accents[0] ?? "#1b8f60", names: {} as Record<string, string> });

export function CustomPanel({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const [v, setV] = useState(view.custom ?? DEFAULT_CUSTOM(view.customOptions.logos, view.customOptions.accents));
  const b = view.business;
  if (!view.pro)
    return (
      <section className="card card-pad stack bg-locked" style={{ gap: 8 }} data-testid="biz-custom-locked">
        <div className="biz-sec-head">
          <h2>Свой бизнес · Pro</h2>
          <Icon name="lock" size="sm" />
        </div>
        <div className="bg-preview" aria-hidden>
          <span style={{ background: "#0b7a4b" }}>🚀</span>
          <span style={{ background: "#3fbf7f" }}>🧁</span>
          <span style={{ background: "#0e5c3c" }}>🎧</span>
        </div>
        <p className="muted biz-small" style={{ margin: 0 }}>
          Свой логотип, оттенок зелёного, свои названия улучшений и премиум-предметы. Капитал всё так же — только ваши накопления.
        </p>
        <Link href="/pro" className={btnClass("primary", "sm")}>
          Открыть в Pro
        </Link>
      </section>
    );
  if (!b.isFounder) return null;
  return (
    <section className="card card-pad stack" style={{ gap: 10 }} data-testid="biz-custom">
      <div className="biz-sec-head">
        <h2>Оформление · Pro</h2>
        <span className="muted biz-small">логотип, оттенок, свои названия</span>
      </div>
      <CustomFields value={v} onChange={setV} view={view} kind={b.kind} />
      <Button size="sm" variant="primary" loading={busy === "custom"} onClick={() => act("custom", "/api/biz/custom", { emoji: v.emoji, accent: v.accent, names: Object.fromEntries(Object.entries(v.names).filter(([, n]) => n.trim().length >= 2)) }, () => "Оформление сохранено")}>
        Сохранить
      </Button>
    </section>
  );
}

export function SwitchBusiness({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const b = view.business;
  const [kind, setKind] = useState<BizKind>(b.kind === "coffee" ? "webstudio" : "coffee");
  const [name, setName] = useState("");
  if (!b.isFounder) return null;
  const go = async () => {
    const r = await act("switch", "/api/biz/switch", { kind, name: name.trim() || KINDS[kind].title }, () => `Новый бизнес: ${KINDS[kind].title}`);
    if (r) ref.current?.close();
  };
  return (
    <>
      <button className="biz-link" onClick={() => ref.current?.showModal()} data-testid="biz-switch-open">
        Сменить тип бизнеса
      </button>
      <dialog ref={ref} className="bg-dialog card card-pad" aria-labelledby="bg-switch-title">
        <div className="stack" style={{ gap: 12 }}>
          <h2 id="bg-switch-title">Новый бизнес</h2>
          <p className="muted biz-small" style={{ margin: 0 }}>
            Смена типа = новый бизнес для всей команды: улучшения, история, инвесторы и кризисы начнутся заново. Капитал {rub(b.capital)} останется — это ваши накопления. Награды за челленджи тоже останутся.
          </p>
          <div className="biz-kinds">
            {BIZ_KIND_IDS.filter((k) => k !== b.kind).map((k) => (
              <button type="button" key={k} className={`biz-kind ${kind === k ? "is-on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                <b>
                  {KINDS[k].emoji} {KINDS[k].title}
                </b>
                <span className="muted biz-small">{TEMPLATE_TITLES[KINDS[k].template]}</span>
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="bg-switch-name">Название</label>
            <input id="bg-switch-name" className="input" maxLength={40} value={name} placeholder={KINDS[kind].title} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button variant="primary" loading={busy === "switch"} onClick={go} data-testid="biz-switch-confirm">
              Да, начать новый бизнес
            </Button>
            <Button variant="ghost" onClick={() => ref.current?.close()}>
              Отмена
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function ChallengesPanel({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [err, setErr] = useState("");
  async function pick(f: File | undefined) {
    setErr("");
    if (!f) return setImage(null);
    try {
      setImage(await fileToGoalImage(f));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function send(id: string) {
    const r = await act(`ch-${id}`, "/api/biz/challenges", { id, text, image }, () => "Отправлено на проверку");
    if (r) {
      setOpen(null);
      setText("");
      setImage(null);
    }
  }
  return (
    <section className="card card-pad stack" style={{ gap: 12 }} data-testid="biz-challenges">
      <div className="biz-sec-head">
        <h2>Челленджи недели</h2>
        <span className="muted biz-small">проверяет модератор · награда — уникальный предмет в бизнес</span>
      </div>
      <div className="biz-chs">
        {view.challenges.map((c) => (
          <div key={c.id} className={`biz-ch ${c.status === "approved" ? "is-done" : ""}`} data-testid={`bch-${c.id}`}>
            <b>{c.title}</b>
            <span className="muted biz-small">{c.blurb}</span>
            <span className="biz-small">
              Награда: «{c.item.title}» <span className="bg-badge">за челлендж</span> · ★ +{c.rating} · +{c.coins} PigCoin$
            </span>
            <span className="biz-bar">
              <i style={{ width: `${Math.round((c.progress / c.target) * 100)}%` }} />
            </span>
            <span className="biz-small num muted">
              подтверждённые взносы: {rub(c.progress)} из {rub(c.target)}
            </span>
            {c.status === "rejected" && <span className="biz-small bg-reject">Не принято: {c.comment}</span>}
            <div className="biz-up-foot">
              {c.status === "approved" ? (
                <span className="badge pos">Засчитано</span>
              ) : c.status === "pending" ? (
                <span className="badge" data-testid="bch-pending">
                  На проверке
                </span>
              ) : open === c.id ? null : (
                <Button size="sm" variant="accent" onClick={() => setOpen(c.id)}>
                  {c.status === "rejected" ? "Отправить ещё раз" : "Выполнил"}
                </Button>
              )}
            </div>
            {open === c.id && (
              <div className="stack" style={{ gap: 6 }}>
                <textarea className="input textarea" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Коротко: что сделали и сколько отложили (10–500 символов)" aria-label="Описание" />
                <label className="biz-small">
                  Фото (необязательно):{" "}
                  <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
                </label>
                {err && <span className="biz-error">{err}</span>}
                <div className="row" style={{ gap: 8 }}>
                  <Button size="sm" variant="primary" disabled={text.trim().length < 10} loading={busy === `ch-${c.id}`} onClick={() => send(c.id)}>
                    Отправить на проверку
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
