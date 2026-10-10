"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ErrorBox } from "@/components/ui/States";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";
import { rub } from "@/lib/client/format";
import { computeModel } from "@/lib/bizplan/model";
import { PlanInputSchema, STEPS, type PlanInput, type StepId } from "@/lib/bizplan/schema";

type Item = { name: string; amount: number };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="bp-field">
      <span className="label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function NumInput({ value, onChange, label, suffix = "₽", min = 0 }: { value: number; onChange: (n: number) => void; label: string; suffix?: string; min?: number }) {
  return (
    <span className="bp-num">
      <input className="input" type="number" inputMode="decimal" min={min} aria-label={label} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      <i>{suffix}</i>
    </span>
  );
}

function ItemList({ items, onChange, max, nameLabel, add, testid }: { items: Item[]; onChange: (x: Item[]) => void; max: number; nameLabel: string; add: string; testid: string }) {
  return (
    <div className="bp-list" data-testid={testid}>
      {items.map((it, i) => (
        <div className="bp-row" key={i}>
          <input className="input" aria-label={nameLabel} placeholder={nameLabel} maxLength={80} value={it.name} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <NumInput label={`${nameLabel}: сумма`} value={it.amount} onChange={(n) => onChange(items.map((x, j) => (j === i ? { ...x, amount: n } : x)))} />
          <button type="button" className="bp-del" aria-label="Удалить строку" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Icon name="close" size="sm" />
          </button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...items, { name: "", amount: 0 }])}>
          <Icon name="plus" size="sm" /> {add}
        </button>
      )}
      <div className="bp-total">
        Итого: <b>{rub(items.reduce((s, x) => s + (x.amount || 0), 0))}</b>
      </div>
    </div>
  );
}

/** Which step a validation error path belongs to, so the wizard can jump there. */
function stepOf(path: string): number {
  const k = path.split(".")[0];
  const map: Record<string, StepId> = { title: "idea", idea: "idea", audience: "audience", competitors: "competitors", price: "pricing", unitCost: "pricing", taxPct: "pricing", startup: "startup", monthly: "monthly", sales: "sales", channels: "channels", team: "team", risks: "risks" };
  return Math.max(0, STEPS.findIndex((s) => s.id === map[k]));
}

export function Wizard({ initial, planId }: { initial: PlanInput; planId?: string }) {
  const [v, setV] = useState<PlanInput>(initial);
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState<Record<number, string>>({});
  const [hintBusy, setHintBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, string>>({});
  const router = useRouter();
  const set = <K extends keyof PlanInput>(k: K, val: PlanInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const s = STEPS[step];

  const preview = useMemo(() => {
    const r = PlanInputSchema.safeParse({ ...v, title: v.title || "Проект", idea: v.idea.length >= 20 ? v.idea : "x".repeat(20), audience: v.audience.length >= 5 ? v.audience : "клиенты", price: v.price || 1, competitors: v.competitors.filter((c) => c.name), startup: v.startup.filter((x) => x.name), monthly: v.monthly.filter((x) => x.name), channels: v.channels.filter((x) => x.name), team: v.team.filter((x) => x.name), risks: v.risks.filter((x) => x.trim().length >= 2) });
    return r.success ? computeModel(r.data) : null;
  }, [v]);

  const stepError = (): string | null => {
    if (s.id === "idea" && (v.title.trim().length < 2 || v.idea.trim().length < 20)) return "Назовите проект и опишите идею хотя бы в паре предложений (от 20 символов).";
    if (s.id === "audience" && v.audience.trim().length < 5) return "Опишите, кто ваш клиент.";
    if (s.id === "pricing" && !(v.price > 0)) return "Цена должна быть больше нуля.";
    return null;
  };

  async function askPig() {
    setHintBusy(true);
    try {
      const r = await api<{ hint: string }>("/api/plan/hint", { method: "POST", body: { step: s.id, title: v.title, idea: v.idea, audience: v.audience, price: v.price, unitCost: v.unitCost } });
      setHint((h) => ({ ...h, [step]: r.hint }));
    } catch (e) {
      setHint((h) => ({ ...h, [step]: errorMessage(e) }));
    } finally {
      setHintBusy(false);
    }
  }

  function next() {
    const e = stepError();
    setError(e);
    if (!e) setStep((x) => Math.min(STEPS.length - 1, x + 1));
  }

  async function submit() {
    const e = stepError();
    if (e) return setError(e);
    // Empty rows are dropped instead of failing validation.
    const input: PlanInput = { ...v, competitors: v.competitors.filter((c) => c.name.trim()), startup: v.startup.filter((x) => x.name.trim()), monthly: v.monthly.filter((x) => x.name.trim()), channels: v.channels.filter((x) => x.name.trim()), team: v.team.filter((x) => x.name.trim()), risks: v.risks.map((r) => r.trim()).filter((r) => r.length >= 2) };
    setBusy(true);
    setError(null);
    setDetails({});
    try {
      const r = planId ? await api<{ id: string }>(`/api/plan/${planId}`, { method: "PUT", body: { input } }) : await api<{ id: string }>("/api/plan", { method: "POST", body: { input } });
      router.push(`/plan/${r.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiClientError && err.details) {
        setDetails(err.details);
        const first = Object.keys(err.details)[0];
        if (first) setStep(stepOf(first.replace(/^input\./, "")));
      }
      setBusy(false);
    }
  }

  return (
    <div className="bp-wizard">
      <ol className="bp-steps" aria-label="Шаги">
        {STEPS.map((x, i) => (
          <li key={x.id}>
            <button type="button" className={i === step ? "is-current" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined} onClick={() => (i <= step || !stepError()) && setStep(i)}>
              <b>{i < step ? <Icon name="check" size="sm" /> : i + 1}</b>
              <span>{x.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="bp-main">
        <section className="card bp-card" data-testid={`bp-step-${s.id}`}>
          <span className="label">
            Шаг {step + 1} из {STEPS.length}
          </span>
          <h2>{s.title}</h2>

          {s.id === "idea" && (
            <>
              <Field label="Название проекта">
                <input className="input" maxLength={80} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Кофейня у метро" />
              </Field>
              <Field label="Идея" hint={`${v.idea.length}/1500`}>
                <textarea className="input" rows={5} maxLength={1500} value={v.idea} onChange={(e) => set("idea", e.target.value)} placeholder="Какую проблему решаете, что продаёте и почему вам купят" />
              </Field>
            </>
          )}
          {s.id === "audience" && (
            <Field label="Кто ваш клиент" hint={`${v.audience.length}/800`}>
              <textarea className="input" rows={5} maxLength={800} value={v.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Возраст, город, доход, какая у них задача и где они её сейчас решают" />
            </Field>
          )}
          {s.id === "competitors" && (
            <div className="bp-list">
              {v.competitors.map((c, i) => (
                <div className="bp-row bp-row-3" key={i}>
                  <input className="input" aria-label="Конкурент" placeholder="Конкурент" maxLength={80} value={c.name} onChange={(e) => set("competitors", v.competitors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <NumInput label="Цена конкурента" value={c.price} onChange={(n) => set("competitors", v.competitors.map((x, j) => (j === i ? { ...x, price: n } : x)))} />
                  <input className="input" aria-label="Чем силён или слаб" placeholder="Чем силён или слаб" maxLength={200} value={c.note} onChange={(e) => set("competitors", v.competitors.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                  <button type="button" className="bp-del" aria-label="Удалить строку" onClick={() => set("competitors", v.competitors.filter((_, j) => j !== i))}>
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              ))}
              {v.competitors.length < 6 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("competitors", [...v.competitors, { name: "", price: 0, note: "" }])}>
                  <Icon name="plus" size="sm" /> Добавить конкурента
                </button>
              )}
            </div>
          )}
          {s.id === "pricing" && (
            <div className="bp-grid">
              <Field label="Цена одной продажи">
                <NumInput label="Цена" value={v.price} onChange={(n) => set("price", n)} />
              </Field>
              <Field label="Себестоимость одной продажи">
                <NumInput label="Себестоимость" value={v.unitCost} onChange={(n) => set("unitCost", n)} />
              </Field>
              <Field label="Налог с прибыли" hint="УСН «доходы минус расходы» — 15%, упрощённо 6% для оценки">
                <NumInput label="Налог" suffix="%" value={v.taxPct} onChange={(n) => set("taxPct", n)} />
              </Field>
              <div className="bp-note">
                Маржа с продажи: <b>{rub(v.price - v.unitCost)}</b>
                {v.price > 0 && ` (${Math.round(((v.price - v.unitCost) / v.price) * 100)}%)`}
              </div>
            </div>
          )}
          {s.id === "startup" && <ItemList testid="bp-startup" items={v.startup} onChange={(x) => set("startup", x)} max={20} nameLabel="Статья расходов" add="Добавить расход" />}
          {s.id === "monthly" && <ItemList testid="bp-monthly" items={v.monthly} onChange={(x) => set("monthly", x)} max={20} nameLabel="Статья расходов" add="Добавить расход" />}
          {s.id === "sales" && (
            <div className="bp-grid">
              <Field label="Продаж в первый месяц">
                <NumInput label="Продаж в первый месяц" suffix="шт" value={v.sales.firstMonth} onChange={(n) => set("sales", { ...v.sales, firstMonth: Math.round(n) })} />
              </Field>
              <Field label="Рост в месяц">
                <NumInput label="Рост в месяц" suffix="%" min={-50} value={v.sales.growthPct} onChange={(n) => set("sales", { ...v.sales, growthPct: n })} />
              </Field>
              <Field label="Максимум продаж в месяц" hint="Сколько вы физически успеете обслужить">
                <NumInput label="Максимум продаж" suffix="шт" min={1} value={v.sales.capacity} onChange={(n) => set("sales", { ...v.sales, capacity: Math.max(1, Math.round(n)) })} />
              </Field>
            </div>
          )}
          {s.id === "channels" && <ItemList testid="bp-channels" items={v.channels} onChange={(x) => set("channels", x)} max={10} nameLabel="Канал" add="Добавить канал" />}
          {s.id === "team" && <ItemList testid="bp-team" items={v.team} onChange={(x) => set("team", x)} max={15} nameLabel="Роль" add="Добавить роль" />}
          {s.id === "risks" && (
            <div className="bp-list">
              {v.risks.map((r, i) => (
                <div className="bp-row bp-row-1" key={i}>
                  <input className="input" aria-label="Риск" maxLength={200} value={r} onChange={(e) => set("risks", v.risks.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" className="bp-del" aria-label="Удалить строку" onClick={() => set("risks", v.risks.filter((_, j) => j !== i))}>
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              ))}
              {v.risks.length < 8 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("risks", [...v.risks, ""])}>
                  <Icon name="plus" size="sm" /> Добавить риск
                </button>
              )}
            </div>
          )}

          {Object.keys(details).length > 0 && (
            <ul className="bp-errors">
              {Object.entries(details).map(([k, m]) => (
                <li key={k}>{m}</li>
              ))}
            </ul>
          )}
          {error && <ErrorBox message={error} />}

          <div className="bp-nav">
            <Button type="button" variant="ghost" disabled={step === 0 || busy} onClick={() => { setError(null); setStep((x) => x - 1); }}>
              <Icon name="back" size="sm" /> Назад
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" onClick={next}>
                Далее <Icon name="arrow" size="sm" />
              </Button>
            ) : (
              <Button type="button" variant="primary" loading={busy} onClick={submit} data-testid="bp-submit">
                <Icon name="sparkle" size="sm" /> {planId ? "Пересчитать план" : "Собрать план"}
              </Button>
            )}
          </div>
        </section>

        <aside className="bp-side">
          <div className="bp-pig">
            <div className="bp-pig-head">
              <Icon name="sparkle" size="sm" /> Подсказка CAP
            </div>
            <p>{hint[step] ?? s.hint}</p>
            <button type="button" className="btn btn-sm btn-light" disabled={hintBusy} onClick={askPig}>
              {hintBusy ? "Думаю…" : "Совет для моего проекта"}
            </button>
          </div>
          {preview && (
            <div className="card bp-preview" data-testid="bp-preview">
              <span className="label">Предпросмотр</span>
              <dl>
                <dt>Запуск</dt>
                <dd>{rub(preview.startup)}</dd>
                <dt>Расходы в месяц</dt>
                <dd>{rub(preview.monthlyFixed)}</dd>
                <dt>Безубыточность</dt>
                <dd>{preview.breakEvenUnits === null ? "недостижима" : `${preview.breakEvenUnits} продаж/мес`}</dd>
                <dt>Окупаемость</dt>
                <dd>{preview.payback === null ? "> 3 лет" : `${preview.payback} мес.`}</dd>
                <dt>Прибыль за год</dt>
                <dd className={preview.year.net < 0 ? "neg" : "pos"}>{rub(preview.year.net)}</dd>
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
