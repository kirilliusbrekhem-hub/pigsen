// Effects engine: loaded on demand by components/fx/index.ts, never part of the first page load.
// Plain DOM + one short-lived canvas; everything respects prefers-reduced-motion.

const PALETTE = ["#0E7A52", "#3FBD88", "#55CC99", "#0B0F0D", "#FFFFFF", "#1E4636"];

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function haptic(pattern: number | number[] = 12) {
  try {
    if (!reducedMotion()) navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

type Point = { x: number; y: number };
export type Origin = Element | Point | null | undefined;

function pointOf(o: Origin): Point {
  if (o && "getBoundingClientRect" in o) {
    const r = o.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (o && "x" in o) return o;
  return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  color: string;
  shape: 0 | 1;
  life: number;
}

let canvas: HTMLCanvasElement | null = null;
let particles: Particle[] = [];
let raf = 0;

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "fx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function tick(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 20);
  for (const p of particles) {
    p.vy += 0.18;
    p.vx *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    ctx.globalAlpha = Math.min(1, p.life / 30);
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.shape) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (particles.length) raf = requestAnimationFrame(() => tick(ctx));
  else {
    canvas?.remove();
    canvas = null;
    raf = 0;
  }
}

/** Confetti/particle burst from an element or point. `power` 1 = small pop, 3 = celebration. */
export function burst(origin?: Origin, power = 1) {
  if (reducedMotion()) return;
  const ctx = ensureCanvas();
  if (!ctx) return;
  const { x, y } = pointOf(origin);
  const n = Math.round(28 * power);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (2 + Math.random() * 5) * (0.8 + power * 0.25);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 3.5,
      r: 3 + Math.random() * 3,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
      color: PALETTE[i % PALETTE.length],
      shape: (i % 2) as 0 | 1,
      life: 70 + Math.random() * 40,
    });
  }
  if (!raf) raf = requestAnimationFrame(() => tick(ctx));
}

function visibleTarget(): Element | null {
  for (const el of document.querySelectorAll("[data-fx-target='coins']")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** "+N XP" / "+N PigCoin$" chip that floats up and flies to the header balance. */
export function floatText(text: string, origin?: Origin, delay = 0) {
  const from = pointOf(origin);
  const el = document.createElement("span");
  el.className = "fx-float";
  el.textContent = text;
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${from.x}px`;
  el.style.top = `${from.y}px`;
  document.body.appendChild(el);
  if (reducedMotion() || !el.animate) {
    setTimeout(() => el.remove(), 1400);
    return;
  }
  const target = visibleTarget();
  const to = target ? pointOf(target) : { x: from.x, y: from.y - 90 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  el.animate(
    [
      { transform: "translate(-50%, -50%) scale(.6)", opacity: 0 },
      { transform: "translate(-50%, calc(-50% - 36px)) scale(1.08)", opacity: 1, offset: 0.25 },
      { transform: "translate(-50%, calc(-50% - 40px)) scale(1)", opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0.2 },
    ],
    { duration: 1300, delay, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" },
  ).onfinish = () => {
    el.remove();
    if (target) {
      target.classList.remove("fx-ping");
      void (target as HTMLElement).offsetWidth;
      target.classList.add("fx-ping");
    }
  };
}

/** Full-screen level-up celebration. Closes on click, Esc or after 6 s. */
export function levelUp(level: { index: number; name: string }) {
  document.querySelector(".fx-levelup")?.remove();
  const prev = document.activeElement as HTMLElement | null;
  const wrap = document.createElement("div");
  wrap.className = "fx-levelup";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-labelledby", "fx-lvl-h");
  wrap.setAttribute("data-testid", "levelup-modal");
  wrap.innerHTML = `<div class="fx-levelup-card">
    <div class="fx-levelup-badge"><span>${level.index}</span></div>
    <span class="label">Новый уровень</span>
    <h2 id="fx-lvl-h"></h2>
    <p>Вы растёте! Продолжайте учиться, чтобы открыть следующий уровень.</p>
    <button type="button" class="btn btn-accent">Продолжить</button>
  </div>`;
  wrap.querySelector("h2")!.textContent = level.name;
  const close = () => {
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    wrap.classList.add("out");
    setTimeout(() => wrap.remove(), reducedMotion() ? 0 : 220);
    prev?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
  const timer = setTimeout(close, 6000);
  wrap.addEventListener("click", (e) => (e.target === wrap || (e.target as Element).closest("button")) && close());
  document.addEventListener("keydown", onKey);
  document.body.appendChild(wrap);
  wrap.querySelector("button")?.focus();
  haptic([20, 40, 20, 40, 60]);
  burst({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, 3);
  setTimeout(() => burst({ x: window.innerWidth * 0.25, y: window.innerHeight * 0.4 }, 1.5), 250);
  setTimeout(() => burst({ x: window.innerWidth * 0.75, y: window.innerHeight * 0.4 }, 1.5), 450);
}

export interface RewardInput {
  xp?: number;
  coins?: number;
  origin?: Origin;
  level?: { index: number; name: string };
  leveledUp?: boolean;
  /** Confetti strength; 0 = no burst. */
  power?: number;
}

/** One call for every reward moment: burst, floating counters, haptic, and the level-up modal. */
export function reward({ xp = 0, coins = 0, origin, level, leveledUp, power = 1 }: RewardInput) {
  if (power > 0) burst(origin, power);
  if (xp > 0) floatText(`+${xp} XP`, origin);
  if (coins > 0) floatText(`+${coins} PigCoin$`, origin, xp > 0 ? 180 : 0);
  if (xp > 0 || coins > 0) haptic(power > 1 ? [15, 30, 25] : 15);
  if (leveledUp && level) setTimeout(() => levelUp(level), reducedMotion() ? 0 : 700);
}
