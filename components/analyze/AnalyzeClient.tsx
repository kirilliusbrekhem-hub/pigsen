"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError, api, errorMessage } from "@/lib/client/api";
import { rub } from "@/lib/client/format";
import type { AnalysisResult } from "@/lib/analyze/aggregate";

interface HistoryItem {
  id: string;
  source: string;
  txCount: number;
  total: number;
  createdAt: string;
}
type Mode = "file" | "text" | "photo";
const SOURCE: Record<string, string> = { csv: "Выписка", text: "Текст", photo: "Чек" };
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

async function upload(form: FormData) {
  let res: Response;
  try {
    res = await fetch("/api/analyze", { method: "POST", body: form, credentials: "same-origin" });
  } catch {
    throw new ApiClientError(0, "Нет соединения с сервером. Проверьте интернет.");
  }
  const data = (await res.json().catch(() => null)) as { error?: string; id?: string; result?: AnalysisResult } | null;
  if (!res.ok || !data?.result || !data.id) throw new ApiClientError(res.status, data?.error ?? "Что-то пошло не так");
  return { id: data.id, result: data.result };
}

export function AnalyzeClient({ photo, pro, history: initial }: { photo: boolean; pro: boolean; history: HistoryItem[] }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("file");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [current, setCurrent] = useState<{ id: string; result: AnalysisResult } | null>(null);
  const [history, setHistory] = useState(initial);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(form: FormData) {
    setBusy(true);
    setErr("");
    try {
      const r = await upload(form);
      setCurrent(r);
      setHistory((h) => [{ id: r.id, source: mode === "text" ? "text" : mode === "photo" ? "photo" : "csv", txCount: r.result.txCount, total: r.result.total, createdAt: new Date().toISOString() }, ...h]);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setErr("Файл больше 2 МБ");
    const fd = new FormData();
    fd.set("file", f);
    void run(fd);
  }

  async function open(id: string) {
    try {
      const r = await api<{ id: string; result: AnalysisResult }>(`/api/analyze/${id}`);
      setCurrent({ id: r.id, result: r.result });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/analyze/${id}`, { method: "DELETE" });
      setHistory((h) => h.filter((x) => x.id !== id));
      if (current?.id === id) setCurrent(null);
      toast.show("Разбор удалён");
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    }
  }

  return (
    <div className="stack an-root" style={{ gap: 22 }}>
      <section className="card card-pad an-upload">
        <div className="an-tabs" role="tablist">
          {(["file", "text", "photo"] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={`chip ${mode === m ? "is-selected" : ""}`} onClick={() => (setMode(m), setErr(""))}>
              {m === "file" ? "CSV-выписка" : m === "text" ? "Вставить текст" : "Фото чека"}
            </button>
          ))}
        </div>

        {mode === "file" && (
          <label
            className={`an-drop ${busy ? "is-busy" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files[0]);
            }}
          >
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" aria-label="Файл выписки" hidden onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
            <b>{busy ? "Разбираем…" : "Перетащите CSV или выберите файл"}</b>
            <span className="muted">Сбер, Т-Банк, Альфа и другие банки · до 2 МБ, до 5000 операций. Excel? Сохраните как CSV.</span>
          </label>
        )}

        {mode === "text" && (
          <div className="stack" style={{ gap: 10 }}>
            <textarea className="textarea" aria-label="Текст выписки" rows={7} maxLength={200_000} value={text} onChange={(e) => setText(e.target.value)} placeholder={"12.09.2026 Пятёрочка -450,50\n13.09.2026 Яндекс Go -380\n14.09.2026 Кофе Хаус -260"} />
            <Button
              variant="accent"
              loading={busy}
              disabled={!text.trim()}
              onClick={() => {
                const fd = new FormData();
                fd.set("text", text);
                void run(fd);
              }}
            >
              Разобрать
            </Button>
          </div>
        )}

        {mode === "photo" &&
          (photo ? (
            <label className={`an-drop ${busy ? "is-busy" : ""}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Фото чека" hidden onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
              <b>{busy ? "Распознаём чек…" : "Сфотографируйте или выберите чек"}</b>
              <span className="muted">JPG, PNG или WebP до 2 МБ</span>
            </label>
          ) : (
            <div className="an-drop is-soon">
              <b>Фото скоро</b>
              <span className="muted">Распознавание чеков появится в ближайших обновлениях. Пока загрузите CSV или вставьте текст.</span>
            </div>
          ))}

        {err && (
          <p className="an-err" role="alert">
            {err} {/Pro/.test(err) && <Link href="/pro">Подключить Pro →</Link>}
          </p>
        )}
        <p className="an-privacy muted">Файл не сохраняется: мы читаем его один раз и храним только итоги по категориям. Разбор можно удалить. {pro ? "Pro: разборы без ограничений." : "Free: 1 разбор в неделю, с Pro — без ограничений."}</p>
      </section>

      {current && <Result id={current.id} r={current.result} />}

      {history.length > 0 && (
        <section className="card card-pad stack" style={{ gap: 10 }}>
          <b>Мои разборы</b>
          <ul className="an-history">
            {history.map((h) => (
              <li key={h.id}>
                <button className="an-hist-open" onClick={() => void open(h.id)}>
                  <span>{new Date(h.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} · {SOURCE[h.source] ?? h.source}</span>
                  <span className="muted num">{h.txCount} операций · {rub(h.total)}</span>
                </button>
                <button className="btn btn-ghost btn-sm" aria-label="Удалить разбор" onClick={() => void remove(h.id)}>
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Result({ id, r }: { id: string; r: AnalysisResult }) {
  const toast = useToast();
  const router = useRouter();
  const [monthly, setMonthly] = useState(r.suggestedMonthly);
  const [saving, setSaving] = useState(false);
  const peak = Math.max(1, ...r.categories.map((c) => c.total));
  const mPeak = Math.max(1, ...r.monthTotals.map((m) => m.total));

  async function makeGoal() {
    setSaving(true);
    try {
      const g = await api<{ goal: { id: string } }>(`/api/analyze/${id}/goal`, { method: "POST", body: { monthly, months: 6 } });
      toast.show("Цель создана! Откладывайте по плану.");
      router.push(`/savings/${g.goal.id}`);
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 18 }} data-testid="an-result">
      <section className="an-tiles">
        <div className="card card-pad"><span className="label">Всего трат</span><b className="num">{rub(r.total)}</b><span className="muted">{r.txCount} операций</span></div>
        <div className="card card-pad"><span className="label">В среднем в месяц</span><b className="num">{rub(r.monthlyAvg)}</b><span className="muted">{r.from && r.to ? `${r.from.split("-").reverse().join(".")} — ${r.to.split("-").reverse().join(".")}` : "без дат"}</span></div>
        <div className="card card-pad an-tile-accent"><span className="label">Можно откладывать</span><b className="num">{rub(r.suggestedMonthly)}/мес</b><span className="muted">если прикрыть утечки</span></div>
      </section>

      <section className="card card-pad stack" style={{ gap: 12 }}>
        <b>Траты по категориям</b>
        <div className="an-bars" role="img" aria-label="Траты по категориям">
          {r.categories.map((c, i) => (
            <div key={c.id} className="an-bar">
              <span className="an-bar-label">{c.label}</span>
              <span className="an-bar-track"><span className={`an-bar-fill ${i === 0 ? "is-top" : ""}`} style={{ width: `${Math.max(2, (c.total / peak) * 100)}%` }} /></span>
              <span className="an-bar-val num">{rub(c.total)} <i>{c.share}%</i></span>
            </div>
          ))}
        </div>
      </section>

      {r.leaks.length > 0 && (
        <section className="card card-pad stack" style={{ gap: 12 }}>
          <b>Главные утечки</b>
          <div className="an-leaks">
            {r.leaks.map((l) => (
              <div key={l.kind} className="an-leak">
                <div className="an-leak-head"><b>{l.title}</b><span className="num">~{rub(l.monthly)}/мес</span></div>
                <p className="muted">{l.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.monthTotals.length > 1 && (
        <section className="card card-pad stack" style={{ gap: 12 }}>
          <b>По месяцам</b>
          <div className="admin-bars" role="img" aria-label="Траты по месяцам">
            {r.monthTotals.map((m) => (
              <div key={m.month} className="admin-bar" title={`${m.month}: ${m.total}`}>
                <span className="n num">{Math.round(m.total / 1000)}к</span>
                <span className="b" style={{ height: `${(m.total / mPeak) * 100}%` }} />
                <i>{monthLabel(m.month)}</i>
              </div>
            ))}
          </div>
          {r.monthCompare && (
            <p className="muted">
              {monthLabel(r.monthCompare.last)} к {monthLabel(r.monthCompare.prev)}:{" "}
              <b className={r.monthCompare.diffPct > 0 ? "an-up" : "an-down"}>{r.monthCompare.diffPct > 0 ? "+" : ""}{r.monthCompare.diffPct}%</b>
              {r.monthCompare.movers.length > 0 && <> · {r.monthCompare.movers.map((m) => `${m.label} ${m.diff > 0 ? "+" : "−"}${rub(Math.abs(m.diff))}`).join(", ")}</>}
            </p>
          )}
        </section>
      )}

      <section className="card card-pad stack an-pig" style={{ gap: 12 }}>
        <b>$PIG советует</b>
        <ol className="an-recs">
          {r.recommendations.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
        <div className="an-goal">
          <label className="field" style={{ flex: "1 1 200px" }}>
            <span>Откладывать в месяц, ₽</span>
            <input className="input" type="number" inputMode="numeric" min={100} step={100} value={monthly} onChange={(e) => setMonthly(Math.max(0, Math.round(Number(e.target.value) || 0)))} />
          </label>
          <Button variant="accent" loading={saving} disabled={monthly < 100} onClick={() => void makeGoal()}>
            Создать цель в копилке
          </Button>
        </div>
        <span className="muted">Цель на 6 месяцев: {rub(monthly * 6)}.</span>
      </section>
    </div>
  );
}
