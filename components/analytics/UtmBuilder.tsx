"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const BASE = "https://pigsen.vercel.app/";
const PRESETS: { label: string; source: string; medium: string }[] = [
  { label: "Telegram", source: "telegram", medium: "social" },
  { label: "VK", source: "vk", medium: "social" },
  { label: "YouTube", source: "youtube", medium: "video" },
  { label: "TikTok", source: "tiktok", medium: "video" },
  { label: "Instagram Reels", source: "instagram", medium: "reels" },
  { label: "Яндекс Директ", source: "yandex_direct", medium: "cpc" },
];

export function UtmBuilder() {
  const toast = useToast();
  const [f, setF] = useState({ base: BASE, source: "telegram", medium: "social", campaign: "", content: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  let link = "";
  try {
    const u = new URL(f.base || BASE);
    for (const k of ["source", "medium", "campaign", "content"] as const) if (f[k].trim()) u.searchParams.set(`utm_${k}`, f[k].trim());
    link = u.toString();
  } catch {
    link = "";
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.show("Ссылка скопирована");
    } catch {
      toast.show("Не удалось скопировать — выделите ссылку вручную", { kind: "err" });
    }
  }

  const field = (k: keyof typeof f, label: string, ph = "") => (
    <label className="stack utm-field" style={{ gap: 4 }}>
      <span className="label">{label}</span>
      <input className="input" value={f[k]} onChange={set(k)} placeholder={ph} maxLength={k === "base" ? 200 : 100} />
    </label>
  );

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="chips-row">
        {PRESETS.map((p) => (
          <button key={p.source} type="button" className={`chip ${f.source === p.source ? "is-selected" : ""}`} onClick={() => setF({ ...f, source: p.source, medium: p.medium })}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="utm-grid">
        {field("base", "Адрес")}
        {field("source", "utm_source")}
        {field("medium", "utm_medium")}
        {field("campaign", "utm_campaign", "например, autumn_launch")}
        {field("content", "utm_content", "например, reel_01")}
      </div>
      <code className="utm-link">{link || "Некорректный адрес"}</code>
      <div>
        <Button onClick={copy} disabled={!link}>
          Скопировать ссылку
        </Button>
      </div>
    </div>
  );
}
