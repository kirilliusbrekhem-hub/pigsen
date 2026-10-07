"use client";

import { useEffect } from "react";

/** Adds `is-in` to every `.rv` element as it scrolls into view. Content stays visible without JS. */
export function Reveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("is-in"));
      return;
    }
    root.classList.add("rv-on");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
