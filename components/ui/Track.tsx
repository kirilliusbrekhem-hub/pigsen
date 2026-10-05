"use client";
import { useEffect } from "react";

/** Fire-and-forget activity ping after mount (views, lesson starts). */
export function Track({ kind, id }: { kind: "view" | "lesson"; id: string }) {
  useEffect(() => {
    void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id }), keepalive: true }).catch(() => {});
  }, [kind, id]);
  return null;
}
