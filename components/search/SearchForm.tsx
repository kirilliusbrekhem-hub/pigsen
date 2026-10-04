"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function SearchForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setQ(initial);
  }
  useEffect(() => {
    if (!initial) ref.current?.focus();
  }, [initial]);
  return (
    <form
      role="search"
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        router.push(v ? `/search?q=${encodeURIComponent(v)}` : "/search");
      }}
      style={{ display: "flex", gap: 8 }}
    >
      <div className="search" style={{ flex: 1 }}>
        <Icon name="search" />
        <input
          ref={ref}
          className="input"
          style={{ height: 46, fontSize: 15 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Например: венчур, юнит-экономика, Paul Graham, AI"
          aria-label="Поисковый запрос"
          maxLength={120}
        />
      </div>
      <button className="btn btn-primary btn-lg" type="submit" disabled={!q.trim()}>
        Найти
      </button>
    </form>
  );
}
