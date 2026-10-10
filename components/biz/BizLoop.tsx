"use client";
// The daily loop on /biz, top to bottom: level path → scene → «Сегодня» (savings goal of the day + «Отложить», streak,
// tomorrow) → «Событие дня» from $PIG (one decision) → team week. Plus FirstRun: onboarding step 3 (first deposit →
// first item pops into the scene). Deposits go to the real savings goal; capital only ever mirrors those deposits.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { BizView } from "@/lib/biz/service";
import { api, errorMessage } from "@/lib/client/api";
import { rub } from "@/lib/client/format";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Act } from "./BizGame";

const BizScene = dynamic(() => import("./BizScene"), { ssr: false, loading: () => <div className="bz-scene-skel" aria-hidden /> });

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const daysWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "день" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "дня" : "дней");

/** Records a real deposit in the savings goal (creates one if the user has none) and returns the fresh business view. */
function useDeposit(view: BizView, setView: (v: BizView) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (amount: number): Promise<BizView | null> => {
    if (!Number.isFinite(amount) || amount < 1) {
      toast.show("Введите сумму", { kind: "err" });
      return null;
    }
    setBusy(true);
    try {
      const g = view.loop.goal;
      if (g) await api(`/api/savings/${g.id}/entries`, { method: "POST", body: { amount: Math.round(amount), note: "Капитал бизнеса" } });
      else await api("/api/savings", { method: "POST", body: { title: `Капитал «${view.business.name}»`.slice(0, 80), target: Math.max(10_000, Math.round(amount) * 10), initial: Math.round(amount) } });
      const r = await api<{ view: BizView | null }>("/api/biz");
      if (r.view) setView(r.view);
      toast.show(`+${rub(amount)} в копилку — капитал +${rub(amount)}`);
      return r.view;
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { save, busy };
}

function AmountPicker({ value, onChange, presets }: { value: string; onChange: (v: string) => void; presets: number[] }) {
  return (
    <div className="bl-amount">
      <div className="bl-chips" role="group" aria-label="Быстрый выбор суммы">
        {presets.map((p) => (
          <button type="button" key={p} className={`chip ${Number(value) === p ? "is-selected" : ""}`} onClick={() => onChange(String(p))}>
            {rub(p)}
          </button>
        ))}
      </div>
      <label className="bl-input">
                <input className="input" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 7))} aria-label="Сумма, ₽" />
        <span aria-hidden>₽</span>
      </label>
    </div>
  );
}

// ───────────────────────── onboarding step 3 ─────────────────────────

export function FirstRun({ view, setView, onDone }: { view: BizView; setView: (v: BizView) => void; onDone: () => void }) {
  const [amount, setAmount] = useState("300");
  const [step, setStep] = useState<"deposit" | "reveal">("deposit");
  const [item, setItem] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const { save, busy } = useDeposit(view, setView);
  const starter = view.catalog.find((c) => c.id === "starter");
  const b = view.business;

  async function go() {
    const v = await save(Number(amount));
    if (!v) return;
    const s = v.catalog.find((c) => c.id === "starter");
    if (s && s.state === "open" && v.business.capital >= s.price) {
      setBuying(true);
      try {
        const r = await api<{ view: BizView }>("/api/biz/buy", { method: "POST", body: { itemId: "starter" } });
        setView(r.view);
        setItem(s.title);
      } catch {
        /* the deposit counted; the item can be bought from the catalog */
      } finally {
        setBuying(false);
      }
    }
    setStep("reveal");
  }

  return (
    <div className="bo-screen" role="dialog" aria-modal="true" aria-labelledby="fr-title" data-testid="biz-first-run">
      <div className="bo-inner">
        <header className="bo-top">
          <button type="button" className="bo-close" onClick={onDone} aria-label="Позже">
            <Icon name="close" />
          </button>
          <span className="bo-steps" aria-label="Шаг 3 из 3">
            <i className="is-done" />
            <i className="is-done" />
            <i className="is-on" />
          </span>
        </header>
        {step === "deposit" ? (
          <>
            <span className="label">
              {b.emoji} {b.name} · шаг 3 из 3
            </span>
            <h1 id="fr-title">Первый взнос — первый предмет</h1>
            <div className="bo-hero card">
              <BizScene owned={view.owned} level={b.level} guests={3} name={b.name} kind={b.kind} kindTitle={b.kindTitle} catalog={view.catalog.filter((c) => c.id === "starter").map((c) => ({ ...c, state: "locked" }))} />
            </div>
            <p className="bo-lead">
              Отложите любую сумму — по-настоящему: на накопительный счёт, в конверт или копилку. Ровно столько же станет капиталом, и в бизнесе сразу появится{" "}
              <b>«{starter?.title ?? "первый предмет"}»</b>.
            </p>
            <AmountPicker value={amount} onChange={setAmount} presets={[100, 300, 500, 1000]} />
            <p className="muted biz-small">Тратить ничего не нужно: это ваши накопления, они остаются вашими. Снимете — капитал уменьшится так же.</p>
            <div className="bo-cta">
              <Button variant="primary" size="lg" block loading={busy || buying} onClick={go} data-testid="first-deposit">
                Отложить {rub(Number(amount) || 0)}
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="label">Бизнес открыт</span>
            <h1 id="fr-title">{item ? `Появилось: «${item}»` : "Капитал пополнен"}</h1>
            <div className="bo-hero card bl-reveal">
              <BizScene owned={view.owned} level={b.level} guests={10} name={b.name} kind={b.kind} kindTitle={b.kindTitle} rating={b.rating} catalog={view.catalog.filter((c) => view.owned.some((o) => o.itemId === c.id))} />
            </div>
            <p className="bo-lead">
              Капитал: <b>{rub(b.capital)}</b> — столько же, сколько вы отложили. Откладывайте каждый день, чтобы покупать улучшения и вырасти из «{b.levels[0]}» в «{b.levels[b.levels.length - 1]}».
            </p>
            <div className="bo-cta">
              <Button variant="primary" size="lg" block onClick={onDone} data-testid="first-done">
                К моему бизнесу
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── level path ─────────────────────────

export function LevelPath({ view }: { view: BizView }) {
  const b = view.business;
  const l = view.loop.level;
  return (
    <div className="bl-path" data-testid="biz-level">
      <ol>
        {b.levels.map((name, i) => (
          <li key={name} className={i + 1 < b.level ? "is-done" : i + 1 === b.level ? "is-on" : ""}>
            <span className="dot" aria-hidden>
              {i + 1 < b.level ? <Icon name="check" size="sm" /> : i + 1}
            </span>
            <b>{name}</b>
          </li>
        ))}
      </ol>
      {l.next ? (
        <div className="bl-path-next">
          <span className="biz-bar">
            <i style={{ width: `${Math.round((l.have / Math.max(1, l.need)) * 100)}%` }} />
          </span>
          <span className="biz-small">
            До «{l.next}»: {l.have} из {l.need}
            {b.nextNeeds.length > 0 && <span className="muted"> · нужно: {b.nextNeeds.join(", ")}</span>}
          </span>
        </div>
      ) : (
        <span className="biz-small">Максимальный уровень — у вас «{b.levelName}»</span>
      )}
    </div>
  );
}

// ───────────────────────── today ─────────────────────────

export function TodayCard({ view, setView }: { view: BizView; setView: (v: BizView) => void }) {
  const L = view.loop;
  const left = Math.max(0, L.dailyTarget - L.savedToday);
  const [amount, setAmount] = useState(String(left || L.dailyTarget));
  const { save, busy } = useDeposit(view, setView);
  const presets = useMemo(() => [...new Set([left || L.dailyTarget, 100, 500, 1000])].slice(0, 4), [left, L.dailyTarget]);
  const pct = Math.min(100, Math.round((L.savedToday / Math.max(1, L.dailyTarget)) * 100));
  const done = L.savedToday >= L.dailyTarget;

  return (
    <section className="card card-pad bl-today" id="biz-today" data-testid="biz-today">
      <div className="bl-today-head">
        <div>
          <span className="label">Сегодня</span>
          <h2>{done ? "Цель дня выполнена" : `Отложить ${rub(left)}`}</h2>
        </div>
        <span className={`bl-streak ${L.streak ? "is-on" : ""}`} data-testid="biz-streak" title="Дней подряд с взносом в копилку">
          <Icon name="flame" size="sm" /> {L.streak} {daysWord(L.streak)}
        </span>
      </div>
      <div className="bl-goal">
        <span className="biz-bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="biz-small muted">
          отложено сегодня {rub(L.savedToday)} из {rub(L.dailyTarget)}
          {L.goal ? ` · цель «${L.goal.title}»` : ""}
        </span>
      </div>
      <AmountPicker value={amount} onChange={setAmount} presets={presets} />
      <Button variant="primary" size="lg" block loading={busy} onClick={() => save(Number(amount))} data-testid="biz-save">
        <Icon name="piggy" /> Отложить {rub(Number(amount) || 0)}
      </Button>
      <ol className="bl-week" aria-label="Взносы за неделю">
        {L.week.map((d, i) => (
          <li key={d.day} className={`${d.saved ? "is-on" : ""} ${i === 6 ? "is-today" : ""}`}>
            <i aria-hidden>{d.saved ? <Icon name="check" size="sm" /> : null}</i>
            <span>{i === 6 ? "сег." : WEEKDAYS[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
          </li>
        ))}
      </ol>
      <p className="bl-tomorrow">
        <Icon name="moon" size="sm" />
        <span>
          <b>Завтра:</b> {L.tomorrow}. {L.streak ? `Отложите хоть ${rub(100)}, чтобы не прервать серию.` : "Начните серию: взнос каждый день."}
        </span>
      </p>
      <p className="muted biz-small bl-honest">Отмечайте только реально отложенные деньги — капитал бизнеса зеркалит копилку.</p>
    </section>
  );
}

// ───────────────────────── event of the day ─────────────────────────

export function DailyEvent({ view, act, busy }: { view: BizView; act: Act; busy: string | null }) {
  const b = view.business;
  const c = view.crisis;
  const offer = !view.investors.deal && b.isFounder ? view.investors.offers[0] : undefined;
  const story = view.story.find((s) => s.status === "ready");
  const broken = view.catalog.find((u) => u.state === "broken");
  const open = view.catalog.filter((u) => u.state === "open" && !u.challenge);
  const needs = new Set(b.nextNeeds);
  const pick = open.filter((u) => u.price <= b.capital).sort((x, y) => Number(needs.has(y.title)) - Number(needs.has(x.title)) || x.price - y.price)[0];
  const target = pick ?? open.sort((x, y) => Number(needs.has(y.title)) - Number(needs.has(x.title)) || x.price - y.price)[0];

  let kind: string;
  let title: string;
  let text: string;
  let actions: React.ReactNode = null;

  if (c) {
    kind = "crisis";
    title = `Кризис: ${c.title}`;
    text = `${c.text} Решите за 3 дня, иначе всё решится само — и плохо.`;
    actions = c.options.map((o) => (
      <Button
        key={o.id}
        size="sm"
        variant="secondary"
        disabled={!o.affordable || !!busy}
        loading={busy === `crisis-${o.id}`}
        data-testid={`crisis-${o.id}`}
        onClick={() => act<{ view: BizView; outcome: { good: boolean; text: string } }>(`crisis-${o.id}`, "/api/biz/crisis", { crisisId: c.id, optionId: o.id }, (r) => `${r.outcome.good ? "Удалось" : "Не повезло"}: ${r.outcome.text}`)}
      >
        {o.label} <span className="muted">· шанс {o.chance}%</span>
      </Button>
    ));
  } else if (story) {
    kind = "story";
    title = `Глава ${story.n} пройдена: ${story.title}`;
    text = `${story.goalText} — готово. Заберите награду: +${story.coins} PigCoin$ и +${story.xp} XP каждому в команде.`;
    actions = (
      <Button size="sm" variant="primary" loading={busy === "story"} data-testid="daily-story-claim" onClick={() => act<{ view: BizView; coins: number; chapter: number }>("story", "/api/biz/story", {}, (r) => `Глава ${r.chapter} пройдена${r.coins ? `: +${r.coins} PigCoin$` : ""}`)}>
        Забрать награду
      </Button>
    );
  } else if (offer) {
    kind = "investor";
    title = `${offer.avatar} ${offer.name} хочет в долю`;
    text = `«${offer.pitch}» Условие: ${offer.goal} за ${offer.deadlineDays} дн. Награда: ${offer.reward}. Денег инвестор не даёт — только игровой буст.`;
    actions = (
      <>
        <Button size="sm" variant="primary" loading={busy === `inv-${offer.id}`} disabled={!!busy} onClick={() => act(`inv-${offer.id}`, "/api/biz/investors", { investorId: offer.id, action: "accept" }, () => `Сделка с ${offer.name} заключена`)}>
          Принять
        </Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(`inv-${offer.id}-no`, "/api/biz/investors", { investorId: offer.id, action: "decline" }, () => "Вы отказались")}>
          Отказаться
        </Button>
      </>
    );
  } else if (broken) {
    kind = "repair";
    title = `«${broken.title}» на ремонте`;
    text = `После снятия из копилки часть улучшений сломалась. Починка — ${rub(broken.repair)} капитала.`;
    actions = (
      <Button size="sm" variant="primary" disabled={b.capital < broken.repair || !!busy} loading={busy === `buy-${broken.id}`} onClick={() => act(`buy-${broken.id}`, "/api/biz/buy", { itemId: broken.id, repair: true }, () => `«${broken.title}» снова в строю`)}>
        {b.capital < broken.repair ? `Не хватает ${rub(broken.repair - b.capital)}` : "Починить"}
      </Button>
    );
  } else if (target) {
    kind = "buy";
    const short = target.price - b.capital;
    title = pick ? `Совет $PIG: «${target.title}»` : `Копим на «${target.title}»`;
    text = `${target.blurb}.${needs.has(target.title) ? ` Нужно для уровня «${b.levels[b.level] ?? ""}».` : ""} ${pick ? `Хватает капитала: ${rub(target.price)}.` : `Не хватает ${rub(short)} — отложите, и купим.`}`;
    actions = pick ? (
      <Button size="sm" variant="primary" loading={busy === `buy-${target.id}`} disabled={!!busy} data-testid="daily-buy" onClick={() => act<{ view: BizView; levelUp: number | null }>(`buy-${target.id}`, "/api/biz/buy", { itemId: target.id }, (r) => (r.levelUp ? `Новый уровень: «${r.view.business.levels[r.levelUp - 1]}»!` : `«${target.title}» куплено`))}>
        Купить за {rub(target.price)}
      </Button>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => document.getElementById("biz-today")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
        <Icon name="piggy" size="sm" /> Отложить
      </Button>
    );
  } else {
    kind = "calm";
    title = "Всё куплено";
    text = "Каталог закрыт — растите рейтинг, проходите историю и зовите друзей в команду.";
  }

  return (
    <section className={`card card-pad bl-event is-${kind}`} data-testid="biz-daily">
      <div data-testid={kind === "crisis" ? "biz-crisis" : undefined} className="bl-event-in">
        <div className="bl-event-head">
          <span className="biz-avatar" aria-hidden>
            $
          </span>
          <div>
            <span className="label">Событие дня · день {b.dayNo}</span>
            <h2>{title}</h2>
          </div>
        </div>
        <p className="bl-event-day">
          <Icon name="sparkle" size="sm" /> {b.today.event}
        </p>
        <p className="bl-event-text">{text}</p>
        {kind === "crisis" && view.pigPartner && c && <p className="biz-small bg-pigsay">$PIG: {c.pig}</p>}
        {actions && <div className="bg-opts">{actions}</div>}
      </div>
    </section>
  );
}

// ───────────────────────── team week ─────────────────────────

export function TeamWeek({ view }: { view: BizView }) {
  const t = view.loop.team;
  if (!t) return null;
  const pct = Math.min(100, Math.round((t.total / Math.max(1, t.target)) * 100));
  const max = Math.max(1, ...t.members.map((m) => m.amount));
  return (
    <section className="card card-pad bl-team" data-testid="biz-team-week">
      <div className="bl-today-head">
        <div>
          <span className="label">Команда · неделя</span>
          <h2>
            {rub(t.total)} из {rub(t.target)}
          </h2>
        </div>
        <span className={`bl-streak ${pct >= 100 ? "is-on" : ""}`}>{pct}%</span>
      </div>
      <span className="biz-bar">
        <i style={{ width: `${pct}%` }} />
      </span>
      <ul className="bl-members">
        {t.members.map((m) => (
          <li key={m.userId} className={m.you ? "is-me" : ""}>
            <span className="biz-avatar sm" aria-hidden>
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="bl-m-name">
              {m.name}
              {m.you ? " (вы)" : ""}
            </span>
            <span className="bl-m-bar">
              <i style={{ width: `${Math.round((m.amount / max) * 100)}%` }} />
            </span>
            <b className="num">{rub(m.amount)}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
