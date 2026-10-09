"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { rub } from "@/lib/client/format";

const MAX_INPUT = 3 * 1024 * 1024;
const MAX_SIDE = 1600;
const TARGET = 900 * 1024;
export const PROOF_PRIVACY = "Скрин видит только проверка, удаляем через 30 дней.";
export type ProofState = "confirmed" | "pending" | "unconfirmed";
const LABEL: Record<ProofState, string> = { confirmed: "подтверждён", pending: "на проверке", unconfirmed: "не подтверждён" };

/**
 * Re-encodes a screenshot to JPEG ≤ 1600px (the canvas drops EXIF/geo data) and returns a data URL.
 * Only JPEG/PNG/WebP up to 3 MB are accepted; the server re-checks everything.
 */
export async function fileToProofImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Нужен скриншот JPEG, PNG или WebP");
  if (file.size > MAX_INPUT) throw new Error("Скриншот больше 3 МБ");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Не удалось открыть картинку"));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Браузер не умеет обрабатывать картинки");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if ((out.length - out.indexOf(",") - 1) * 0.75 <= TARGET) return out;
    }
    throw new Error("Скриншот слишком большой, обрежьте его");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** "Приложить скрин перевода" for the deposit form. */
export function ProofPicker({ value, onChange, disabled }: { value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="proof-pick" data-testid="proof-picker">
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label="Скриншот перевода"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            onChange(await fileToProofImage(f));
          } catch (err) {
            toast.show(errorMessage(err), { kind: "err" });
          }
        }}
      />
      {value ? (
        <span className="proof-chosen">
          <Icon name="check" size="sm" /> Скриншот приложен
          <button type="button" className="link-btn muted" onClick={() => onChange(null)} disabled={disabled}>
            убрать
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.click()} disabled={disabled}>
          <Icon name="camera" size="sm" /> Приложить скрин перевода
        </button>
      )}
      <span className="muted proof-note">
        <Icon name="shield" size="sm" /> Подтверждённые взносы идут в лидерборд бизнесов и челленджи. {PROOF_PRIVACY}
      </span>
    </div>
  );
}

export function ProofBadge({ state }: { state: ProofState }) {
  return (
    <span className={`proof-badge is-${state}`} data-testid="proof-badge" data-state={state}>
      {state === "confirmed" ? "✓ " : ""}
      {LABEL[state]}
    </span>
  );
}

/** Status of one deposit in the history, with "Подтвердить" for deposits without a screenshot. */
export function EntryProof({ entryId, state }: { entryId: string; state: ProofState }) {
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(f: File) {
    setBusy(true);
    try {
      const image = await fileToProofImage(f);
      const r = await api<{ proof: { label: string } }>("/api/savings/proofs", { method: "POST", body: { entryId, image } });
      toast.show(`Скриншот отправлен: ${r.proof.label}`);
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="proof-entry">
      <ProofBadge state={state} />
      {state === "unconfirmed" && (
        <>
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Скриншот для подтверждения" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }} />
          <button type="button" className="biz-link" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? "Отправляем…" : "Подтвердить"}
          </button>
        </>
      )}
    </span>
  );
}

/** "Подтверждено X из Y ₽" meter. */
export function ProofMeter({ confirmed, pending, total }: { confirmed: number; pending: number; total: number }) {
  const pc = total ? Math.round((confirmed / total) * 100) : 0;
  const pp = total ? Math.round((pending / total) * 100) : 0;
  return (
    <div className="proof-meter" data-testid="proof-meter">
      <div className="proof-meter-head">
        <b>
          Подтверждено {rub(confirmed)} из {rub(total)}
        </b>
        {pending > 0 && <span className="muted">на проверке {rub(pending)}</span>}
      </div>
      <div className="proof-bar" aria-hidden>
        <i className="c" style={{ width: `${pc}%` }} />
        <i className="p" style={{ width: `${pp}%` }} />
      </div>
      <span className="muted proof-note">Неподтверждённые взносы остаются в вашей копилке, но в лидерборд бизнесов и челленджи идут только подтверждённые.</span>
    </div>
  );
}
