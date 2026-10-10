"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BizView } from "@/lib/biz/service";
import { api, errorMessage } from "@/lib/client/api";
import { rub } from "@/lib/client/format";
import { useToast } from "@/components/ui/Toast";
import { Button, btnClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import dynamic from "next/dynamic";
import { DailyEvent, FirstRun, LevelPath, TeamWeek, TodayCard } from "./BizLoop";
import { ChallengesPanel, CustomPanel, InvestorsPanel, StoryPanel, SwitchBusiness } from "./BizGame";

// Scene is heavy SVG + an animation loop: load it lazily, client-only.
const BizScene = dynamic(() => import("./BizScene"), { ssr: false, loading: () => <div className="bz-scene-skel" aria-hidden /> });

const POLL_MS = 8000;
const n = (x: number) => Math.round(x).toLocaleString("ru-RU");
const time = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function effectText(e: { guests?: number; check?: number; rating?: number; churn?: number; bugs?: number }, noun = "гостей") {
  return [
    e.guests ? `+${e.guests} ${noun}` : "",
    e.check ? `+${e.check} к чеку` : "",
    e.rating ? `+${e.rating} ★` : "",
    e.churn ? `${e.churn < 0 ? "−" : "+"}${Math.round(Math.abs(e.churn) * 100)}% отток` : "",
    e.bugs ? `${e.bugs < 0 ? "−" : "+"}${Math.abs(e.bugs)} багов` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Free teams: $PIG is not a partner here — upsell to Pro (founder's plan). */
function PigPartnerLock({ compact = false }: { compact?: boolean }) {
  return (
    <div className="pig-lock" data-testid="pig-lock">
      <span className="ic" aria-hidden>
        <Icon name="lock" size="sm" />
      </span>
      <div>
        <b>$PIG-партнёр доступен в Pro</b>
        {!compact && <p>Сооснователь в чате команды, идеи «давай попробуем…», стратегия игры и разборы по цифрам. Включается, когда основатель команды на Pro.</p>}
        {compact && <p>В Free $PIG не отвечает в чате команды — он работает как ассистент в разделе «$PIG».</p>}
        <Link href="/pro" className={btnClass("primary", "sm")}>
          Открыть Pro
        </Link>
      </div>
    </div>
  );
}

export function BizApp({ initial }: { initial: BizView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"feed" | "chat">("feed");
  const [firstRun, setFirstRun] = useState(initial.loop.firstRun);
  const [msg, setMsg] = useState("");
  const toast = useToast();
  const router = useRouter();
  const chatEnd = useRef<HTMLDivElement>(null);
  const b = view.business;

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ view: BizView | null }>("/api/biz");
      if (r.view) setView(r.view);
      else router.refresh();
    } catch {
      /* polling is best-effort */
    }
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (tab === "chat") chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [tab, view.chat.length]);

  async function act<T extends { view?: BizView }>(key: string, path: string, body?: unknown, ok?: (r: T) => string | null) {
    setBusy(key);
    try {
      const r = await api<T>(path, { method: "POST", body: body ?? {} });
      if (r.view) setView(r.view);
      const text = ok?.(r);
      if (text) toast.show(text);
      return r;
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  const buy = (id: string, title: string, repair = false) =>
    act<{ view: BizView; reward: number; levelUp: number | null }>(`buy-${id}`, "/api/biz/buy", { itemId: id, repair }, (r) =>
      r.levelUp ? `Новый уровень: «${r.view.business.levels[r.levelUp - 1]}»!` : repair ? `«${title}» снова в строю` : `«${title}» куплено${r.reward ? `, +${r.reward} PigCoin$` : ""}`,
    );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    const r = await act("chat", "/api/biz/chat", { text: msg });
    if (r) setMsg("");
  }

  async function copyInvite() {
    if (!b.invitePath) return;
    const url = `${location.origin}${b.invitePath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Ссылка-приглашение скопирована");
    } catch {
      prompt("Скопируйте ссылку", url);
    }
  }

  async function leave() {
    if (!confirm(view.members.length > 1 ? "Выйти из бизнеса? Команда продолжит без вас." : "Закрыть бизнес? Все улучшения пропадут.")) return;
    if (await act("leave", "/api/biz/leave")) router.refresh();
  }

  const member = (action: "kick" | "transfer", userId: string, name: string) => {
    if (!confirm(action === "kick" ? `Исключить ${name} из команды?` : `Передать роль основателя: ${name}?`)) return;
    act(`${action}-${userId}`, "/api/biz/members", { action, userId }, () => (action === "kick" ? `${name} больше не в команде` : `Основатель теперь ${name}`));
  };

  const pigLast = [...view.chat].reverse().find((c) => c.pig);
  const ratingPct = Math.round((b.rating / 5) * 100);
  const spots = b.maxMembers - view.members.length;

  return (
    <div className="biz stack">
      <section className="biz-head">
        <div>
          <span className="label">
            {b.kindTitle} · {b.templateTitle} · день {b.dayNo}
          </span>
          <h1 className="bg-title" style={b.accent ? ({ "--bg-accent": b.accent } as React.CSSProperties) : undefined}>
            <span className="bg-logo" aria-hidden>
              {b.emoji}
            </span>
            {b.name}
          </h1>
          <LevelPath view={view} />
        </div>
        <span className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link href="/biz/top" className={btnClass("secondary", "md")}>
          <Icon name="trophy" /> Лидерборд
        </Link>
        <Link href="/savings" className={btnClass("primary", "md")}>
          <Icon name="piggy" /> Пополнить копилку
        </Link>
        </span>
      </section>

      <section className="card biz-stage">
        <div className="bz-scene-wrap">
          <BizScene owned={view.owned} level={b.level} guests={b.today.guests} name={b.name} kind={b.kind} kindTitle={b.kindTitle} rating={b.rating} mood={b.today.mood} catalog={view.catalog} onPick={(id) => document.querySelector(`[data-testid="up-${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })} />
        </div>
        <p className="biz-event" data-mood={b.today.mood}>
          <Icon name="sparkle" size="sm" /> {b.today.event}
          <span className="badge" data-testid="biz-mood">
            {b.today.moodLabel} · {b.today.mood}/100
          </span>
          {b.today.penalty > 0 && <span className="badge neg">−{Math.round(b.today.penalty * 100)}% гостей после снятия</span>}
        </p>
      </section>

      {firstRun && <FirstRun view={view} setView={setView} onDone={() => setFirstRun(false)} />}
      <div className="bl-loop">
        <TodayCard key={view.loop.savedToday} view={view} setView={setView} />
        <DailyEvent view={view} act={act} busy={busy} />
        <TeamWeek view={view} />
      </div>

      <section className="biz-metrics">
        <div className="card biz-metric biz-capital" data-testid="biz-capital">
          <span className="k">Капитал</span>
          <b className="num" data-value={b.capital}>
            {rub(b.capital)}
          </b>
          <span className="d">= ваши взносы в копилку</span>
        </div>
        <div className="card biz-metric">
          <span className="k">{b.labels.guests}</span>
          <b className="num" data-testid="biz-guests">{n(b.today.guests)}</b>
          <span className="d">{b.template === "it" ? `отток ${Math.round(b.today.churn * 100)}% · багов ${b.today.bugs}` : `всего ${n(b.guestsTotal)} · игровое`}</span>
        </div>
        <div className="card biz-metric">
          <span className="k">{b.labels.check}</span>
          <b className="num">{n(b.today.check)}</b>
          <span className="d">игровые монеты</span>
        </div>
        <div className="card biz-metric">
          <span className="k">Рейтинг</span>
          <b className="num" data-testid="biz-rating">{b.rating.toFixed(1)} ★</b>
          <span className="biz-bar">
            <i style={{ width: `${ratingPct}%` }} />
          </span>
        </div>
        <div className="card biz-metric">
          <span className="k">{b.template === "it" ? "MRR" : b.labels.revenue}</span>
          <b className="num">{n(b.template === "it" ? b.today.mrr : b.today.revenue)}</b>
          <span className="d">
            всего {n(b.revenueTotal)} · игровая{b.equity ? ` · инвесторам ${Math.round(b.equity * 100)}%` : ""}
          </span>
        </div>
      </section>

      <p className="biz-note muted">
        <Icon name="shield" size="sm" /> Капитал — зеркало ваших реальных накоплений: каждый взнос в копилку добавляет столько же, снятие — отнимает. Тратить настоящие деньги не нужно,
        выручка и гости — игровые.
      </p>

      <div className="biz-grid">
        <div className="stack">
          <section className="card card-pad biz-pig">
            <div className="biz-pig-head">
              <span className="biz-avatar" aria-hidden>
                $
              </span>
              <div>
                <b>$PIG · ИИ-сооснователь</b>
                <span className="muted">иногда ошибается — и честно признаётся</span>
              </div>
            </div>
            {view.pigPartner && pigLast && <p className="biz-pig-text">{pigLast.text}</p>}
            {view.pigPartner || view.pro ? (
              <div className="row" style={{ flexWrap: "wrap" }}>
                <Button size="sm" variant="secondary" loading={busy === "advice"} onClick={() => act("advice", "/api/biz/advice", {}, () => "$PIG посчитал — смотрите чат").then(() => setTab("chat"))}>
                  Разбор по цифрам
                </Button>
                <span className="muted biz-small">{view.pro ? "3 разбора в день" : "1 разбор в день · 3 с Pro"}</span>
              </div>
            ) : (
              <PigPartnerLock />
            )}
          </section>

          <StoryPanel view={view} act={act} busy={busy} />
          <InvestorsPanel view={view} act={act} busy={busy} />
          <ChallengesPanel view={view} act={act} busy={busy} />

          <section className="card card-pad stack" style={{ gap: 12 }}>
            <div className="biz-sec-head">
              <h2>Улучшения</h2>
              <span className="muted biz-small">цены — в рублях капитала из копилки</span>
            </div>
            <div className="biz-catalog">
              {view.catalog.map((u) => {
                const short = u.state === "open" && b.capital < u.price;
                return (
                  <article key={u.id} className={`biz-up is-${u.state}`} data-testid={`up-${u.id}`}>
                    <div className="biz-up-top">
                      <b>{u.title}</b>
                      {u.premium && <span className="badge pos">Pro</span>}
                      {u.exclusive && <span className="badge pos">Инвестор</span>}
                      {u.challenge && <span className="badge pos bg-badge">за челлендж</span>}
                    </div>
                    <span className="muted biz-small">{u.blurb}</span>
                    <span className="biz-fx">{effectText(u.effect, b.labels.guestsShort)}</span>
                    <div className="biz-up-foot">
                      <span className="num biz-price">{u.challenge ? "" : rub(u.state === "broken" ? u.repair : u.price)}</span>
                      {u.state === "open" && (
                        <Button size="sm" variant={short ? "secondary" : "accent"} disabled={short} loading={busy === `buy-${u.id}`} onClick={() => buy(u.id, u.title)} title={short ? `Не хватает ${rub(u.price - b.capital)}` : undefined}>
                          {short ? `Ещё ${rub(u.price - b.capital)}` : "Купить"}
                        </Button>
                      )}
                      {u.state === "owned" && (
                        <span className="badge pos">
                          <Icon name="check" /> Есть
                        </span>
                      )}
                      {u.state === "broken" && (
                        <Button size="sm" variant="secondary" loading={busy === `buy-${u.id}`} disabled={b.capital < u.repair} onClick={() => buy(u.id, u.title, true)}>
                          Починить
                        </Button>
                      )}
                      {u.state === "pro" && (
                        <Link href="/pro" className={btnClass("ghost", "sm")}>
                          <Icon name="lock" /> Pro
                        </Link>
                      )}
                      {(u.state === "locked" || u.state === "investor" || u.state === "challenge") && <span className="muted biz-small">{u.reason}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad stack" style={{ gap: 10 }}>
            <div className="biz-sec-head">
              <h2>Команда</h2>
              <span className="muted biz-small">
                {view.members.length} из {b.maxMembers} + $PIG
              </span>
            </div>
            <ul className="biz-team">
              {view.members.map((m) => (
                <li key={m.userId}>
                  <span className="biz-avatar sm" aria-hidden>
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="biz-team-name">
                    <b>
                      {m.name}
                      {m.you && " (вы)"}
                    </b>
                    <span className="muted biz-small">
                      {m.role === "founder" ? "основатель" : "сооснователь"} · вклад {rub(m.contributed)}
                      {m.confirmed > 0 && (
                        <span className="proof-badge is-confirmed" title="Подтверждено скриншотом перевода" data-testid="member-confirmed">
                          {" "}✓ {rub(m.confirmed)}
                        </span>
                      )}
                    </span>
                  </span>
                  {b.isFounder && !m.you && (
                    <span className="biz-team-act">
                      <button className="biz-link" onClick={() => member("transfer", m.userId, m.name)} disabled={!!busy}>
                        Сделать основателем
                      </button>
                      <button className="biz-link neg" onClick={() => member("kick", m.userId, m.name)} disabled={!!busy}>
                        Исключить
                      </button>
                    </span>
                  )}
                </li>
              ))}
              <li>
                <span className="biz-avatar sm pig" aria-hidden>
                  $
                </span>
                <span className="biz-team-name">
                  <b>$PIG</b>
                  <span className="muted biz-small">ИИ-сооснователь</span>
                </span>
              </li>
            </ul>
            {spots > 0 ? (
              <Button size="sm" variant="secondary" onClick={copyInvite} data-testid="biz-invite">
                <Icon name="link" /> Пригласить друга
              </Button>
            ) : (
              <p className="muted biz-small">{spots < 0 ? `В команде больше людей, чем позволяет план основателя (${b.maxMembers}). Все остаются, но новых пригласить нельзя.` : b.maxMembers >= 10 ? "Команда в сборе." : "Команда в сборе. Больше мест — в Pro у основателя: до 4, 7 или 10 человек."}</p>
            )}
            {b.invitePath && spots > 0 && (
              <code className="biz-code" data-testid="biz-invite-path">
                {b.invitePath}
              </code>
            )}
            <SwitchBusiness view={view} act={act} busy={busy} />
            <button className="biz-link neg" onClick={leave} disabled={!!busy}>
              {view.members.length > 1 ? "Выйти из бизнеса" : "Закрыть бизнес"}
            </button>
          </section>

          <CustomPanel key={view.custom ? JSON.stringify(view.custom) : "none"} view={view} act={act} busy={busy} />

          <section className="card card-pad stack biz-feedbox" style={{ gap: 10 }}>
            <div className="biz-tabs" role="tablist">
              <button role="tab" aria-selected={tab === "feed"} className={`chip ${tab === "feed" ? "is-selected" : ""}`} onClick={() => setTab("feed")}>
                Лента
              </button>
              <button role="tab" aria-selected={tab === "chat"} className={`chip ${tab === "chat" ? "is-selected" : ""}`} onClick={() => setTab("chat")}>
                Чат команды
              </button>
            </div>
            {tab === "feed" ? (
              <ol className="biz-feed" data-testid="biz-feed">
                {view.events.map((e) => (
                  <li key={e.id} className={`ev-${e.kind}`}>
                    <i aria-hidden />
                    <span>
                      {e.text}
                      <time className="muted">{time(e.at)}</time>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <>
                {!view.pigPartner && <PigPartnerLock compact />}
                <div className="biz-chat" data-testid="biz-chat">
                  {view.chat.map((c) => (
                    <div key={c.id} className={`biz-msg ${c.pig ? "pig" : ""} ${c.mine ? "mine" : ""}`}>
                      <b>{c.name}</b>
                      <p>{c.text}</p>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form className="biz-send" onSubmit={send}>
                  <input className="input" value={msg} maxLength={300} onChange={(e) => setMsg(e.target.value)} placeholder="Написать команде или $PIG…" aria-label="Сообщение" />
                  <Button size="sm" variant="primary" loading={busy === "chat"} type="submit" aria-label="Отправить">
                    <Icon name="send" />
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
