"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function keyToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** "Включить напоминания" + test button. Renders nothing when the server has no VAPID key. */
export function PushToggle({ publicKey, compact = false }: { publicKey: string | null; compact?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    let alive = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported" as const;
      if (Notification.permission === "denied") return "denied" as const;
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      return sub ? ("on" as const) : ("off" as const);
    })()
      .catch(() => "off" as const)
      .then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [publicKey]);

  if (!publicKey) return null;

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey!) }));
      await api("/api/push/subscribe", { method: "POST", body: sub.toJSON() });
      setState("on");
      toast.show("Напоминания включены 🐷");
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setState("off");
      toast.show("Напоминания выключены");
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      await api("/api/push/test", { method: "POST" });
      toast.show("Отправили! Уведомление придёт через пару секунд.");
    } catch (err) {
      toast.show(errorMessage(err), { kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`push-box ${compact ? "" : "card card-pad"}`}>
      <span className="push-ic">
        <Icon name="bell" />
      </span>
      <div className="push-text">
        <b>Напоминания копилки</b>
        <span className="muted">
          {state === "on"
            ? "Включены: раз в день $PIG напомнит о цели."
            : state === "denied"
              ? "Уведомления запрещены в настройках браузера. Разрешите их для этого сайта."
              : state === "unsupported"
                ? "Браузер не поддерживает уведомления. На iPhone добавьте сайт на экран «Домой»."
                : "Раз в день — короткое напоминание, сколько осталось до цели."}
        </span>
      </div>
      <div className="push-actions">
        {state === "off" && (
          <button className="btn btn-accent btn-sm" onClick={enable} disabled={busy}>
            Включить напоминания
          </button>
        )}
        {state === "on" && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={test} disabled={busy}>
              Отправить тестовое уведомление
            </button>
            <button className="btn btn-ghost btn-sm" onClick={disable} disabled={busy}>
              Выключить
            </button>
          </>
        )}
      </div>
    </div>
  );
}
