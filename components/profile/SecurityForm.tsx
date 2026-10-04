"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ApiClientError, errorMessage } from "@/lib/client/api";

export function SecurityForm() {
  const router = useRouter();
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"logout" | "delete" | "clear" | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!cur) errs.currentPassword = "Введите текущий пароль";
    if (next.length < 8) errs.newPassword = "Минимум 8 символов";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api("/api/profile/password", { method: "POST", body: { currentPassword: cur, newPassword: next } });
      setCur("");
      setNext("");
      toast.show("Пароль изменён");
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setErrors(err.details);
      else toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setSaving(false);
    }
  }

  async function action(kind: "logout" | "delete" | "clear") {
    setBusy(kind);
    try {
      if (kind === "clear") {
        await api("/api/ai/conversations", { method: "DELETE" });
        toast.show("История разговоров с $PIG очищена");
        setBusy(null);
        router.refresh();
        return;
      }
      await api(kind === "logout" ? "/api/auth/logout" : "/api/profile", { method: kind === "logout" ? "POST" : "DELETE" });
      window.location.href = kind === "logout" ? "/login" : "/";
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
      setBusy(null);
    }
  }

  return (
    <>
      <form className="card card-pad stack" onSubmit={changePassword} noValidate>
        <h3 style={{ fontSize: 15 }}>Сменить пароль</h3>
        <div className="form-grid">
          <div className={`field ${errors.currentPassword ? "err" : ""}`}>
            <label htmlFor="pw-cur">Текущий пароль</label>
            <input id="pw-cur" type="password" className="input" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
            {errors.currentPassword && <span className="hint">{errors.currentPassword}</span>}
          </div>
          <div className={`field ${errors.newPassword ? "err" : ""}`}>
            <label htmlFor="pw-new">Новый пароль</label>
            <input id="pw-new" type="password" className="input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <span className="hint">{errors.newPassword ?? "Не меньше 8 символов."}</span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="primary" type="submit" loading={saving}>
            Обновить пароль
          </Button>
        </div>
      </form>
      <div className="card set-group">
        <div className="set-row">
          <div>
            <div className="t">Очистить историю $PIG</div>
            <div className="d">Удаляет все разговоры. Прогресс и сохранения останутся.</div>
          </div>
          <Button size="sm" onClick={() => action("clear")} loading={busy === "clear"}>
            Очистить
          </Button>
        </div>
        <div className="set-row">
          <div>
            <div className="t">Выйти из аккаунта</div>
            <div className="d">Завершить сессию на этом устройстве.</div>
          </div>
          <Button size="sm" onClick={() => action("logout")} loading={busy === "logout"}>
            Выйти
          </Button>
        </div>
        <div className="set-row">
          <div>
            <div className="t">Удалить аккаунт</div>
            <div className="d">Навсегда удаляет профиль, прогресс, сохранения и разговоры.</div>
          </div>
          {confirmDelete ? (
            <div className="row" style={{ gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
              <Button size="sm" variant="danger" onClick={() => action("delete")} loading={busy === "delete"}>
                Да, удалить
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Удалить
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
