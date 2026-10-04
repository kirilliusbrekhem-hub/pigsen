"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { InterestsPicker, type InterestOption } from "./InterestsPicker";

export function InterestsForm({ options, initial }: { options: InterestOption[]; initial: string[] }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const dirty = value.slice().sort().join() !== initial.slice().sort().join();

  async function save() {
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { interests: value } });
      toast.show("Интересы обновлены. Рекомендации пересчитаны.");
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <InterestsPicker options={options} value={value} onChange={setValue} />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
          Сохранить интересы
        </Button>
      </div>
    </div>
  );
}
