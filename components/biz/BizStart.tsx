"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { ACCENTS, KINDS, LOGOS, TEMPLATE_TITLES, type BizKind, type Template } from "@/lib/biz/catalog";
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
}

const TEMPLATES: Template[] = ["offline", "online", "it"];

export function BizStart({ kinds, defaultName, hasGoals, pro = false }: { kinds: Kind[]; defaultName: string; hasGoals: boolean; pro?: boolean }) {
  const [kind, setKind] = useState<BizKind>("coffee");
  const [name, setName] = useState(defaultName);
  const [custom, setCustom] = useState(false);
  const [emoji, setEmoji] = useState<string>(LOGOS[7]);
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function create(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="biz stack">
      <section className="biz-head">
        <div>
          <span className="label">Мой бизнес</span>
          <h1>Бизнес, который растёт из вашей копилки</h1>
          <p className="muted">
            Каждый рубль, который вы откладываете в копилку, становится капиталом вашего виртуального бизнеса. Снимаете деньги — бизнес страдает. $PIG — ваш ИИ-сооснователь, друзья — партнёры.
          </p>
        </div>
      </section>
      <section className="card biz-stage">
        <BizScene owned={[]} level={1} guests={8} name={KINDS[kind].levels[0]} kind={kind} kindTitle={KINDS[kind].title} />
      </section>
      <form className="card card-pad stack" onSubmit={create}>
        <h2>Какой бизнес открываем?</h2>
        {TEMPLATES.map((t) => (
          <div key={t} className="stack" style={{ gap: 8 }}>
            <span className="label">{TEMPLATE_TITLES[t]}</span>
            <div className="biz-kinds">
              {kinds
                .filter((k) => (k.template ?? "offline") === t)
                .map((k) => (
                  <button
                    type="button"
                    key={k.kind}
                    className={`biz-kind ${kind === k.kind ? "is-on" : ""}`}
                    disabled={!k.available}
                    onClick={() => {
                      setKind(k.kind as BizKind);
                      if (name === defaultName || Object.values(KINDS).some((x) => name.startsWith(x.title))) setName(`${k.title} ${defaultName.split(" ").slice(1).join(" ")}`.trim().slice(0, 40));
                    }}
                    aria-pressed={kind === k.kind}
                    data-testid={`kind-${k.kind}`}
                  >
                    <b>
                      {k.emoji} {k.title}
                    </b>
                    <span className="muted biz-small">{k.blurb}</span>
                    <span className="biz-small">{k.available ? k.levels.join(" → ") : "Скоро"}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        <div className="field">
          <label htmlFor="biz-name">Название</label>
          <input id="biz-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className={`card card-pad stack ${pro ? "" : "bg-locked"}`} style={{ gap: 10 }} data-testid="custom-biz">
          <div className="biz-sec-head">
            <b>Свой бизнес · Pro</b>
            {!pro && <Icon name="lock" size="sm" />}
          </div>
          <span className="muted biz-small">Шаблон — выбранный выше тип ({TEMPLATE_TITLES[KINDS[kind].template]}), а логотип, оттенок и названия улучшений — ваши. Плюс премиум-предметы.</span>
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
            <>
              <div className="bg-preview" aria-hidden>
                <span style={{ background: "#0b7a4b" }}>🚀</span>
                <span style={{ background: "#3fbf7f" }}>🧁</span>
                <span style={{ background: "#0e5c3c" }}>🎧</span>
              </div>
              <Link href="/pro" className={btnClass("secondary", "sm")}>
                <Icon name="lock" size="sm" /> Открыть в Pro
              </Link>
            </>
          )}
        </div>

        {!hasGoals && (
          <p className="biz-note muted">
            <Icon name="piggy" size="sm" /> У вас пока нет цели в копилке. <Link href="/savings">Создайте цель</Link> — взносы в неё станут капиталом бизнеса.
          </p>
        )}
        {error && <p className="biz-error">{error}</p>}
        <Button variant="primary" loading={busy} type="submit">
          Открыть бизнес
        </Button>
      </form>
    </div>
  );
}
