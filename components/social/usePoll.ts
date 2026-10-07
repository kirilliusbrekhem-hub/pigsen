"use client";
import { useEffect, useRef } from "react";

/** Calls `fn` every `ms` while the tab is visible (and once when it becomes visible again). */
export function usePoll(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    let busy = false;
    const tick = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        await ref.current();
      } catch {
        /* ignore network hiccups */
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(tick, ms);
    const onVis = () => void tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, enabled]);
}
