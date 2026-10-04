"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";

/** Downscales an image file to a 160px square JPEG data URL in the browser. */
async function toAvatarDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Поддерживаются PNG, JPEG и WebP");
  if (file.size > 8 * 1024 * 1024) throw new Error("Файл больше 8 МБ");
  const bitmap = await createImageBitmap(file);
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось обработать изображение");
  const s = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PersonalForm({ name: initialName, email, bio: initialBio, avatar: initialAvatar, memberSince }: { name: string; email: string; bio: string; avatar: string | null; memberSince: string }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = name !== initialName || bio !== initialBio || avatar !== initialAvatar;

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      setAvatar(await toAvatarDataUrl(file));
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setErrors({ name: "Минимум 2 символа" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await api("/api/profile", { method: "PATCH", body: { name: name.trim(), bio: bio.trim(), avatar } });
      toast.show("Профиль сохранён");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setErrors(err.details);
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card card-pad stack" onSubmit={save} noValidate>
      <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
        <Avatar name={name || initialName} src={avatar} className="xl" />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 560, fontSize: 16 }}>{name || initialName}</div>
          <div className="muted">С нами с {memberSince}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size="sm" />
            {avatar ? "Сменить фото" : "Загрузить фото"}
          </Button>
          {avatar && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setAvatar(null)}>
              Убрать
            </Button>
          )}
        </div>
      </div>
      <div className="form-grid">
        <div className={`field ${errors.name ? "err" : ""}`}>
          <label htmlFor="pf-name">Имя</label>
          <input id="pf-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          {errors.name && <span className="hint">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="pf-email">Email</label>
          <input id="pf-email" className="input" value={email} disabled />
          <span className="hint">Используется для входа.</span>
        </div>
        <div className={`field full ${errors.bio ? "err" : ""}`}>
          <label htmlFor="pf-bio">О себе</label>
          <textarea id="pf-bio" className="input textarea" value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} placeholder="Например: строю первый стартап, хочу разобраться в инвестициях" />
          <span className="hint">{errors.bio ?? `${bio.length} / 280`}</span>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="primary" type="submit" loading={saving} disabled={!dirty}>
          Сохранить изменения
        </Button>
      </div>
    </form>
  );
}
