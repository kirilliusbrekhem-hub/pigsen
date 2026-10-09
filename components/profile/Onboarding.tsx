"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBox } from "@/components/ui/States";
import { api, errorMessage } from "@/lib/client/api";
import { InterestsPicker, type InterestOption } from "./InterestsPicker";

export function Onboarding({ name, options, initial }: { name: string; options: InterestOption[]; initial: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState<string[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(interests: string[]) {
    setLoading(true);
    setError(null);
    try {
      await api("/api/profile", { method: "PATCH", body: { interests } });
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  }

  return (
    <div className="stack fade-in" style={{ gap: 22, width: "min(760px, 100%)" }}>
      <div className="stack" style={{ gap: 8 }}>
        <span className="label">Шаг 2 из 2 · Интересы</span>
        <h1 style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-.03em" }}>{name}, что вам интересно?</h1>
        <p className="ink2">Выберите темы, и PìgBiz подберёт материалы, курсы и подсказки $PIG. Изменить выбор можно в профиле.</p>
      </div>
      {error && <ErrorBox message={error} />}
      <InterestsPicker options={options} value={value} onChange={setValue} />
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={() => finish([])} disabled={loading}>
          Пропустить
        </Button>
        <Button variant="primary" size="lg" loading={loading} disabled={!value.length} onClick={() => finish(value)}>
          Продолжить · {value.length}
        </Button>
      </div>
    </div>
  );
}
