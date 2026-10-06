"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";

const MAX_SIDE = 800;
const MAX_BYTES = 300 * 1024;

/** Downscales a picked image to max 800px JPEG (~0.8 quality) and returns a data URL under 300 KB. */
export async function fileToGoalImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(file.type) && !file.type.startsWith("image/")) throw new Error("Выберите картинку");
  const bmp = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не умеет обрабатывать картинки");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.8, 0.65, 0.5, 0.35]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if ((url.length - url.indexOf(",") - 1) * 0.75 <= MAX_BYTES) return url;
  }
  throw new Error("Картинка слишком большая, попробуйте другую");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось открыть картинку"));
    };
    img.src = url;
  });
}

/** File picker with preview, used in the create form. `value` is a data URL or null. */
export function GoalImagePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      onChange(await fileToGoalImage(f));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="goal-pic-pick">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Картинка цели" className="goal-pic-thumb" />
      ) : (
        <span className="goal-pic-thumb goal-pic-empty">
          <Icon name="sparkle" />
        </span>
      )}
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <span className="muted" style={{ fontSize: 13 }}>Фото мечты мотивирует сильнее. Необязательно.</span>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
            {busy ? "Обрабатываем…" : value ? "Заменить" : "Загрузить картинку"}
          </button>
          {value && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
              Убрать
            </button>
          )}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

/** Change/remove the picture of an existing goal. */
export function GoalImageEdit({ goalId, hasImage }: { goalId: string; hasImage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function save(image: string | null) {
    setBusy(true);
    try {
      await api(`/api/savings/${goalId}`, { method: "PATCH", body: { image } });
      toast.show(image ? "Картинка обновлена" : "Картинка удалена");
      router.refresh();
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }
  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      await save(await fileToGoalImage(f));
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="row goal-pic-edit" style={{ gap: 8, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
        <Icon name="plus" size="sm" /> {hasImage ? "Сменить картинку" : "Добавить картинку мечты"}
      </button>
      {hasImage && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void save(null)} disabled={busy}>
          <Icon name="trash" size="sm" /> Убрать
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
