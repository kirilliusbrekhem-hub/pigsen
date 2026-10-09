"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function InviteLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const full = () => `${window.location.origin}${path}`;
  const text = "Учусь управлять деньгами в PìgBiz. Регистрируйся по ссылке и получи 200 PigCoin$:";

  async function copy() {
    try {
      await navigator.clipboard.writeText(full());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируйте ссылку", full());
    }
  }

  async function share() {
    const url = full();
    if (navigator.share) {
      try {
        await navigator.share({ title: "PìgBiz", text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  const tg = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(full())}&text=${encodeURIComponent(text)}`, "_blank", "noopener");

  return (
    <div className="growth-link stack" style={{ gap: 10 }}>
      <code className="growth-link-url" data-testid="invite-url">{path}</code>
      <div className="growth-link-actions">
        <button type="button" className="btn btn-primary" onClick={copy}>
          <Icon name={copied ? "check" : "link"} /> {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={share}>
          <Icon name="send" /> Поделиться
        </button>
        <button type="button" className="btn btn-secondary" onClick={tg}>
          Telegram
        </button>
      </div>
    </div>
  );
}
