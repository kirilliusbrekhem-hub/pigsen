"use client";
import { useSyncExternalStore } from "react";

function greet(h: number) {
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

const noop = () => () => {};

/** Uses the viewer's local clock (server time zone may differ). */
export function Greeting({ name }: { name: string }) {
  const text = useSyncExternalStore(
    noop,
    () => greet(new Date().getHours()),
    () => "Привет",
  );
  return (
    <h1>
      {text}, {name}
    </h1>
  );
}
