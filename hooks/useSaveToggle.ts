"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/components/ui/Toast";

/** Optimistic save/unsave for a ContentItem, with undo and server refresh. */
export function useSaveToggle(contentItemId: string, initial: boolean) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  async function set(next: boolean, silent = false) {
    setBusy(true);
    setSaved(next);
    try {
      if (next) await api("/api/saved", { method: "POST", body: { contentItemId } });
      else await api(`/api/saved/${contentItemId}`, { method: "DELETE" });
      if (!silent) {
        toast.show(next ? "Сохранено в «Сохранённое»" : "Убрано из сохранённого", {
          action: next ? { label: "Открыть", onClick: () => router.push("/saved") } : { label: "Вернуть", onClick: () => void set(true, true) },
        });
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setSaved(!next);
      toast.show(errorMessage(e), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return { saved, busy, toggle: () => set(!saved) };
}
