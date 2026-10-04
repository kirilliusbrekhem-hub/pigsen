"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Segmented, Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import type { AiTone, Theme } from "@/types";

interface Settings {
  theme: Theme;
  aiTone: AiTone;
  dailyGoalMinutes: number;
  notifyDigest: boolean;
  notifyNewContent: boolean;
}

function applyTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

const setRow = (t: string, d: string, ctl: React.ReactNode) => (
  <div className="set-row">
    <div style={{ minWidth: 0 }}>
      <div className="t">{t}</div>
      <div className="d">{d}</div>
    </div>
    {ctl}
  </div>
);

/** Each control saves immediately (optimistic) and rolls back on error. */
export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const router = useRouter();
  const toast = useToast();

  async function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const prev = s;
    setS({ ...s, [key]: value });
    if (key === "theme") applyTheme(value as Theme);
    try {
      await api("/api/profile", { method: "PATCH", body: { [key]: value } });
      toast.show("Настройки сохранены");
      router.refresh();
    } catch (e) {
      setS(prev);
      if (key === "theme") applyTheme(prev.theme);
      toast.show(errorMessage(e), { kind: "err" });
    }
  }

  return (
    <>
      <h3 style={{ fontSize: 15 }}>Внешний вид</h3>
      <div className="card set-group">
        {setRow(
          "Тема",
          "Следовать устройству или выбрать вручную.",
          <Segmented<Theme> label="Тема" value={s.theme} onChange={(v) => update("theme", v)} options={[{ value: "system", label: "Авто" }, { value: "light", label: "Светлая" }, { value: "dark", label: "Тёмная" }]} />,
        )}
      </div>
      <h3 style={{ fontSize: 15 }}>$PIG</h3>
      <div className="card set-group">
        {setRow(
          "Стиль ответов",
          "Как подробно $PIG объясняет темы.",
          <Segmented<AiTone> label="Стиль ответов" value={s.aiTone} onChange={(v) => update("aiTone", v)} options={[{ value: "concise", label: "Коротко" }, { value: "balanced", label: "Баланс" }, { value: "detailed", label: "Подробно" }]} />,
        )}
      </div>
      <h3 style={{ fontSize: 15 }}>Обучение и уведомления</h3>
      <div className="card set-group">
        {setRow(
          "Цель на день",
          "Сколько минут в день вы хотите учиться.",
          <Segmented<string> label="Цель на день" value={String(s.dailyGoalMinutes)} onChange={(v) => update("dailyGoalMinutes", Number(v))} options={["10", "15", "30", "60"].map((m) => ({ value: m, label: `${m} мин` }))} />,
        )}
        {setRow("Еженедельный дайджест", "Подборка материалов по вашим интересам.", <Toggle label="Еженедельный дайджест" on={s.notifyDigest} onChange={(v) => update("notifyDigest", v)} />)}
        {setRow("Новые материалы", "Сообщать о новых курсах и статьях в ваших темах.", <Toggle label="Новые материалы" on={s.notifyNewContent} onChange={(v) => update("notifyNewContent", v)} />)}
      </div>
    </>
  );
}
