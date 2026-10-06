"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";

export interface ContentFormValue {
  id?: string;
  slug?: string;
  title: string;
  description: string;
  body: string;
  type: "article" | "book" | "video" | "podcast";
  category: string;
  author: string;
  source: string;
  url: string;
  readingTime: number;
  tags: string;
  featured: boolean;
  premium: boolean;
  trending: number;
}

const TYPES = [
  ["article", "Статья"],
  ["book", "Книга"],
  ["video", "Видео"],
  ["podcast", "Подкаст"],
] as const;

export function ContentForm({ initial, categories }: { initial: ContentFormValue; categories: Array<{ slug: string; name: string }> }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ContentFormValue>(k: K, val: ContentFormValue[K]) => setV((x) => ({ ...x, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    const body = {
      title: v.title,
      description: v.description,
      body: v.body,
      type: v.type,
      category: v.category,
      author: v.author,
      source: v.source,
      url: v.url,
      readingTime: Math.max(1, Math.round(Number(v.readingTime) || 1)),
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      featured: v.featured,
      premium: v.premium,
      trending: Math.max(0, Math.min(10, Math.round(Number(v.trending) || 0))),
    };
    try {
      const r = await api<{ id: string; slug: string }>(v.id ? `/api/admin/content/${v.id}` : "/api/admin/content", { method: v.id ? "PUT" : "POST", body });
      toast.show(v.id ? "Сохранено" : "Материал опубликован");
      router.push(`/admin/content?saved=${r.slug}`);
      router.refresh();
    } catch (err) {
      const d = (err as { details?: Record<string, string> }).details;
      if (d) setErrors(d);
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!v.id || !confirm("Удалить материал? Его уберут из библиотеки и сохранённого у пользователей.")) return;
    setBusy(true);
    try {
      await api(`/api/admin/content/${v.id}`, { method: "DELETE" });
      toast.show("Удалено");
      router.push("/admin/content");
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <small className="neg">{errors[k]}</small>;
  return (
    <form className="card card-pad stack admin-form" style={{ gap: 14 }} onSubmit={save}>
      <label className="calc-field">
        <span>Заголовок</span>
        <input className="input" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={160} required />
        {err("title")}
      </label>
      <label className="calc-field">
        <span>Краткое описание (видно в карточке)</span>
        <input className="input" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={400} required />
        {err("description")}
      </label>
      <div className="goal-form-grid">
        <label className="calc-field">
          <span>Тип</span>
          <select className="input" value={v.type} onChange={(e) => set("type", e.target.value as ContentFormValue["type"])}>
            {TYPES.map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="calc-field">
          <span>Категория</span>
          <select className="input" value={v.category} onChange={(e) => set("category", e.target.value)}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="calc-field">
          <span>Автор</span>
          <input className="input" value={v.author} onChange={(e) => set("author", e.target.value)} maxLength={120} required />
          {err("author")}
        </label>
        <label className="calc-field">
          <span>Источник</span>
          <input className="input" value={v.source} onChange={(e) => set("source", e.target.value)} maxLength={120} />
        </label>
        <label className="calc-field">
          <span>Ссылка на оригинал (необязательно)</span>
          <input className="input" value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" maxLength={500} />
          {err("url")}
        </label>
        <label className="calc-field">
          <span>Время, минут</span>
          <input className="input" type="number" min={1} max={2000} value={v.readingTime} onChange={(e) => set("readingTime", Number(e.target.value))} />
        </label>
      </div>
      <label className="calc-field">
        <span>Теги через запятую</span>
        <input className="input" value={v.tags} onChange={(e) => set("tags", e.target.value)} placeholder="инвестиции, риск" />
      </label>
      <label className="calc-field">
        <span>Текст (Markdown: ## заголовок, - список, **жирный**)</span>
        <textarea className="input admin-body" value={v.body} onChange={(e) => set("body", e.target.value)} rows={16} maxLength={40000} />
        {err("body")}
      </label>
      <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} /> Рекомендуемый
        </label>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={v.premium} onChange={(e) => set("premium", e.target.checked)} /> Только для Pro
        </label>
        <label className="row" style={{ gap: 8 }}>
          Популярность (0–10)
          <input className="input" style={{ width: 80 }} type="number" min={0} max={10} value={v.trending} onChange={(e) => set("trending", Number(e.target.value))} />
        </label>
      </div>
      <div className="row" style={{ gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        {v.id ? (
          <Button variant="danger" type="button" disabled={busy} onClick={remove}>
            Удалить
          </Button>
        ) : (
          <span />
        )}
        <div className="row" style={{ gap: 10 }}>
          {v.slug && (
            <a className="btn btn-ghost" href={`/library/${v.slug}`} target="_blank" rel="noreferrer">
              Открыть на сайте
            </a>
          )}
          <Button variant="accent" type="submit" loading={busy}>
            {v.id ? "Сохранить" : "Опубликовать"}
          </Button>
        </div>
      </div>
    </form>
  );
}
