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
import { BizScene } from "./BizScene";

const POLL_MS = 8000;
const n = (x: number) => Math.round(x).toLocaleString("ru-RU");
const time = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function effectText(e: { guests?: number; check?: number; rating?: number }) {
  return [e.guests ? `+${e.guests} гостей` : "", e.check ? `+${e.check} к чеку` : "", e.rating ? `+${e.rating} ★` : ""].filter(Boolean).join(" · ");
}

export function BizApp({ initial }: { initial: BizView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"feed" | "chat">("feed");
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
            {b.kindTitle} · день {b.dayNo}
          </span>
          <h1>{b.name}</h1>
          <div className="biz-levels" aria-label="Уровень бизнеса">
            {b.levels.map((l, i) => (
              <span key={l} className={`biz-lvl ${i + 1 === b.level ? "is-on" : i + 1 < b.level ? "is-done" : ""}`}>
                {l}
              </span>
            ))}
          </div>
          {b.nextNeeds.length > 0 && <p className="muted biz-next">До уровня «{b.levels[b.level]}»: {b.nextNeeds.join(", ")}</p>}
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
        <BizScene owned={view.owned} level={b.level} guests={b.today.guests} name={b.name} />
        <p className="biz-event">
          <Icon name="sparkle" size="sm" /> {b.today.event}
          {b.today.penalty > 0 && <span className="badge neg">−{Math.round(b.today.penalty * 100)}% гостей после снятия</span>}
        </p>
      </section>

      <section className="biz-metrics">
        <div className="card biz-metric biz-capital" data-testid="biz-capital">
          <span className="k">Капитал</span>
          <b className="num" data-value={b.capital}>
            {rub(b.capital)}
          </b>
          <span className="d">= ваши взносы в копилку</span>
        </div>
        <div className="card biz-metric">
          <span className="k">Гостей в день</span>
          <b className="num" data-testid="biz-guests">{n(b.today.guests)}</b>
          <span className="d">игровое число</span>
        </div>
        <div className="card biz-metric">
          <span className="k">Средний чек</span>
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
          <span className="k">Выручка дня</span>
          <b className="num">{n(b.today.revenue)}</b>
          <span className="d">всего {n(b.revenueTotal)} · игровая</span>
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
            {pigLast && <p className="biz-pig-text">{pigLast.text}</p>}
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Button size="sm" variant="secondary" loading={busy === "advice"} onClick={() => act("advice", "/api/biz/advice", {}, () => "$PIG посчитал — смотрите чат").then(() => setTab("chat"))}>
                Разбор по цифрам
              </Button>
              <span className="muted biz-small">{view.pro ? "3 разбора в день" : "1 разбор в день · 3 с Pro"}</span>
            </div>
          </section>

          <section className="card card-pad stack" style={{ gap: 12 }} data-testid="biz-challenges">
            <div className="biz-sec-head">
              <h2>Челленджи недели</h2>
              <span className="muted biz-small">засчитываются только реальные взносы в копилку</span>
            </div>
            <div className="biz-chs">
              {view.challenges.map((c) => (
                <div key={c.id} className={`biz-ch ${c.claimed ? "is-done" : ""}`}>
                  <b>{c.title}</b>
                  <span className="muted biz-small">{c.blurb}</span>
                  <span className="biz-bar">
                    <i style={{ width: `${Math.round((c.progress / c.target) * 100)}%` }} />
                  </span>
                  <div className="biz-up-foot">
                    <span className="biz-small num">
                      {rub(c.progress)} из {rub(c.target)} · ★ +{c.rating}
                    </span>
                    {c.claimed ? (
                      <span className="badge pos">Выполнено</span>
                    ) : (
                      <Button size="sm" variant="accent" disabled={c.progress < c.target} loading={busy === `ch-${c.id}`} onClick={() => act<{ coins: number; view: BizView }>(`ch-${c.id}`, "/api/biz/challenges", { id: c.id }, (r) => `Челлендж выполнен: рейтинг +${c.rating}, +${r.coins} PigCoin$`)}>
                        Забрать
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

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
                    </div>
                    <span className="muted biz-small">{u.blurb}</span>
                    <span className="biz-fx">{effectText(u.effect)}</span>
                    <div className="biz-up-foot">
                      <span className="num biz-price">{rub(u.state === "broken" ? u.repair : u.price)}</span>
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
                      {u.state === "locked" && <span className="muted biz-small">{u.reason}</span>}
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
            <button className="biz-link neg" onClick={leave} disabled={!!busy}>
              {view.members.length > 1 ? "Выйти из бизнеса" : "Закрыть бизнес"}
            </button>
          </section>

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
