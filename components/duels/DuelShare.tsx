"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function DuelShare({ code, stake }: { code: string; stake: number }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}/duels/j/${code}`;
  const text = `Вызываю тебя на дуэль по финансам в PìgBiz${stake ? ` на ${stake} PigCoin$` : ""}! 7 вопросов, 15 секунд на каждый.`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Скопируйте ссылку", url());
    }
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Дуэль PìgBiz", text, url: url() });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    copy();
  }
  return (
    <div className="duel-share">
      <code className="duel-share-url" data-testid="duel-invite">/duels/j/{code}</code>
      <div className="duel-row">
        <button type="button" className="btn btn-primary" onClick={share}><Icon name="send" /> Поделиться</button>
        <button type="button" className="btn btn-secondary" onClick={copy}><Icon name={copied ? "check" : "link"} /> {copied ? "Скопировано" : "Копировать"}</button>
      </div>
    </div>
  );
}
