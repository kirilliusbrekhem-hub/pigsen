"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { burst, haptic } from "@/components/fx";
import type { InteractiveBlock } from "@/lib/learning/interactive";

/** Renders the interactive blocks of a lesson (flip cards, ordering, check-yourself, slider calculators). */
export function LessonInteractive({ blocks }: { blocks: InteractiveBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="ix-stack" data-testid="lesson-interactive">
      {blocks.map((b, i) =>
        b.type === "flip" ? (
          <FlipCards key={i} {...b} />
        ) : b.type === "order" ? (
          <OrderSteps key={i} {...b} />
        ) : b.type === "check" ? (
          <CheckCard key={i} {...b} />
        ) : (
          <SliderCalc key={i} {...b} />
        ),
      )}
    </div>
  );
}

const win = (el?: Element | null) => {
  haptic([10, 30, 20]);
  burst(el, 1.2);
};

export function FlipCards({ title, cards }: { title: string; cards: { front: string; back: string }[] }) {
  const [open, setOpen] = useState<boolean[]>(() => cards.map(() => false));
  return (
    <section className="ix-card">
      <h3 className="ix-h">
        <Icon name="repeat" size="sm" /> {title}
      </h3>
      <p className="muted ix-sub">Нажмите на карточку, чтобы перевернуть</p>
      <div className="flip-grid">
        {cards.map((c, i) => (
          <button
            key={i}
            type="button"
            className={`flip ${open[i] ? "on" : ""}`}
            aria-pressed={open[i]}
            onClick={() => {
              haptic(6);
              setOpen((o) => o.map((v, j) => (j === i ? !v : v)));
            }}
          >
            <span className="flip-in">
              <span className="flip-face front">{c.front}</span>
              <span className="flip-face back">{c.back}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** A deterministic shuffle (same on server and client) that never returns the solved order. */
function scramble(n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => ((a * 7 + 3) % 11) - ((b * 7 + 3) % 11));
  return idx.every((v, i) => v === i) ? idx.reverse() : idx;
}

export function OrderSteps({ title, hint, items }: { title: string; hint: string; items: string[] }) {
  const [order, setOrder] = useState(() => scramble(items.length));
  const [drag, setDrag] = useState<number | null>(null);
  const [checked, setChecked] = useState<null | boolean>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setChecked(null);
    setOrder((o) => {
      const next = [...o];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };
  return (
    <section className="ix-card">
      <h3 className="ix-h">
        <Icon name="sliders" size="sm" /> {title}
      </h3>
      <p className="muted ix-sub">{hint}</p>
      <ol className="order-list">
        {order.map((item, pos) => (
          <li
            key={item}
            className={`order-item ${drag === pos ? "drag" : ""} ${checked !== null ? (item === pos ? "ok" : "bad") : ""}`}
            draggable
            onDragStart={() => setDrag(pos)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, pos);
              setDrag(null);
            }}
            onDragEnd={() => setDrag(null)}
          >
            <span className="num order-n">{pos + 1}</span>
            <span style={{ flex: 1 }}>{items[item]}</span>
            <button type="button" className="icon-btn" aria-label="Выше" disabled={pos === 0} onClick={() => move(pos, pos - 1)}>
              <Icon name="up" size="sm" />
            </button>
            <button type="button" className="icon-btn" aria-label="Ниже" disabled={pos === order.length - 1} onClick={() => move(pos, pos + 1)}>
              <Icon name="chev" size="sm" />
            </button>
          </li>
        ))}
      </ol>
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            const ok = order.every((v, i) => v === i);
            setChecked(ok);
            if (ok) win(e.currentTarget);
            else haptic(40);
          }}
        >
          Проверить
        </button>
        {checked === true && <span className="ix-ok">Верно! Отличная логика.</span>}
        {checked === false && <span className="ix-bad">Почти. Зелёные стоят на месте, остальные переставьте.</span>}
      </div>
    </section>
  );
}

export function CheckCard({ question, options, answer, explain }: { question: string; options: string[]; answer: number; explain: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <section className="ix-card">
      <h3 className="ix-h">
        <Icon name="bulb" size="sm" /> Проверь себя
      </h3>
      <p style={{ margin: "4px 0 10px" }}>{question}</p>
      <div className="check-opts">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            className={`check-opt ${picked !== null && i === answer ? "ok" : ""} ${picked === i && i !== answer ? "bad" : ""}`}
            disabled={picked !== null}
            onClick={(e) => {
              setPicked(i);
              if (i === answer) win(e.currentTarget);
              else haptic(40);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={picked === answer ? "ix-ok" : "ix-bad"} style={{ marginTop: 10 }}>
          {picked === answer ? "Верно! " : "Не совсем. "}
          {explain}
        </p>
      )}
      {picked !== null && picked !== answer && (
        <button type="button" className="link-btn" onClick={() => setPicked(null)}>
          Попробовать ещё раз
        </button>
      )}
    </section>
  );
}

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

function Slider({ label, value, set, min, max, step, fmt }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; fmt: (n: number) => string }) {
  return (
    <label className="ix-slider">
      <span className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted">{label}</span>
        <b className="num">{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} />
    </label>
  );
}

export function SliderCalc({ title, formula }: { title: string; formula: "compound" | "unit" }) {
  const [a, setA] = useState(formula === "compound" ? 5000 : 1500);
  const [b, setB] = useState(formula === "compound" ? 10 : 3);
  const [c, setC] = useState(formula === "compound" ? 10 : 6);
  const out = useMemo(() => {
    if (formula === "compound") {
      // a: monthly deposit, b: annual %, c: years
      const r = b / 100 / 12;
      const n = c * 12;
      const total = r ? a * ((Math.pow(1 + r, n) - 1) / r) : a * n;
      const put = a * n;
      return { main: rub(total), sub: `Вложено ${rub(put)}, доход ${rub(total - put)}`, ratio: put / total };
    }
    // a: CAC, b: margin per month (thousand ₽), c: months the client stays
    const ltv = b * 1000 * c;
    const k = ltv / a;
    return { main: `LTV/CAC = ${k.toFixed(1)}`, sub: `LTV ${rub(ltv)} при CAC ${rub(a)}. ${k >= 3 ? "Клиент окупается с запасом" : k >= 1 ? "Окупается, но запас мал" : "Клиент убыточен"}`, ratio: Math.min(1, 1 / Math.max(k, 0.01)) };
  }, [formula, a, b, c]);
  return (
    <section className="ix-card">
      <h3 className="ix-h">
        <Icon name="chart" size="sm" /> {title}
      </h3>
      {formula === "compound" ? (
        <>
          <Slider label="Откладываю в месяц" value={a} set={setA} min={500} max={50000} step={500} fmt={rub} />
          <Slider label="Доходность в год" value={b} set={setB} min={0} max={20} step={1} fmt={(n) => `${n}%`} />
          <Slider label="Срок" value={c} set={setC} min={1} max={30} step={1} fmt={(n) => `${n} лет`} />
        </>
      ) : (
        <>
          <Slider label="CAC: стоимость клиента" value={a} set={setA} min={100} max={10000} step={100} fmt={rub} />
          <Slider label="Маржа с клиента в месяц" value={b} set={setB} min={0.1} max={5} step={0.1} fmt={(n) => rub(n * 1000)} />
          <Slider label="Сколько месяцев клиент с вами" value={c} set={setC} min={1} max={36} step={1} fmt={(n) => `${n} мес`} />
        </>
      )}
      <div className="ix-out" aria-live="polite">
        <b className="num">{out.main}</b>
        <span className="muted">{out.sub}</span>
        <span className="qbar">
          <i style={{ width: `${Math.round((1 - out.ratio) * 100)}%` }} />
        </span>
      </div>
    </section>
  );
}
