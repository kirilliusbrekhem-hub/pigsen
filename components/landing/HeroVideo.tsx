"use client";

import { useEffect, useRef } from "react";
import { HERO_VIDEO } from "./data";

/**
 * Poster first; the video file is fetched only after the page has loaded, the
 * browser is idle and the player is on screen. Skipped for Save-Data and reduced motion.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || !HERO_VIDEO.src) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let io: IntersectionObserver | undefined;
    const start = () => {
      io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io?.disconnect();
        v.src = HERO_VIDEO.src;
        v.play().catch(() => {});
      });
      io.observe(v);
    };
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600));
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
    return () => {
      removeEventListener("load", idle);
      io?.disconnect();
    };
  }, []);

  return <video ref={ref} className="lp-video" muted loop playsInline preload="none" poster={HERO_VIDEO.poster} width={HERO_VIDEO.width} height={HERO_VIDEO.height} aria-label="Демо: как выглядит PIGSEN изнутри" />;
}
