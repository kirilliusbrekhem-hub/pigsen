"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BizScene } from "./BizScene";

interface Kind {
  kind: string;
  title: string;
  blurb: string;
  available: boolean;
  levels: string[];
}

export function BizStart({ kinds, defaultName, hasGoals }: { kinds: Kind[]; defaultName: string; hasGoals: boolean }) {
  const [kind, setKind] = useState("coffee");
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/biz", { method: "POST", body: { kind, name } });
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
            Каждый рубль, который вы откладываете в копилку, становится капиталом вашей виртуальной кофейни. Снимаете деньги — бизнес страдает. $PIG — ваш ИИ-сооснователь, друзья — партнёры.
          </p>
        </div>
      </section>
      <section className="card biz-stage">
        <BizScene owned={[]} level={1} guests={8} name="Ларёк" />
      </section>
      <form className="card card-pad stack" onSubmit={create}>
        <h2>Какой бизнес открываем?</h2>
        <div className="biz-kinds">
          {kinds.map((k) => (
            <button
              type="button"
              key={k.kind}
              className={`biz-kind ${kind === k.kind ? "is-on" : ""}`}
              disabled={!k.available}
              onClick={() => setKind(k.kind)}
              aria-pressed={kind === k.kind}
            >
              <b>{k.title}</b>
              <span className="muted biz-small">{k.blurb}</span>
              <span className="biz-small">{k.available ? k.levels.join(" → ") : "Скоро"}</span>
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="biz-name">Название</label>
          <input id="biz-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
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
