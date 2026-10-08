"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";

export function PlanActions({ id, pro }: { id: string; pro: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function remove() {
    if (!window.confirm("Удалить этот бизнес-план? Это нельзя отменить.")) return;
    setBusy(true);
    try {
      await api(`/api/plan/${id}`, { method: "DELETE" });
      router.push("/plan");
      router.refresh();
    } catch (e) {
      toast.show(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <div className="bp-actions">
      <a className="btn btn-primary" href={`/api/plan/${id}/pdf`} download data-testid="bp-pdf">
        <Icon name="download" size="sm" /> Скачать PDF{pro ? "" : " (с водяным знаком)"}
      </a>
      <Link className="btn btn-secondary" href={`/plan/${id}/edit`}>
        <Icon name="edit" size="sm" /> Изменить
      </Link>
      <Button variant="ghost" loading={busy} onClick={remove} data-testid="bp-delete">
        <Icon name="trash" size="sm" /> Удалить
      </Button>
    </div>
  );
}
