export type Goal = "register" | "first_lesson" | "pro_click" | "pro_trial";

type Ym = (id: number, action: "reachGoal", goal: string) => void;
type Gtag = (cmd: "event", name: string, params?: Record<string, unknown>) => void;

/** GA4 recommended event names where they exist. */
const GA_NAMES: Record<Goal, string> = { register: "sign_up", first_lesson: "first_lesson", pro_click: "begin_checkout", pro_trial: "pro_trial" };

/** Sends a goal to Yandex.Metrica and GA4. Each provider is optional; safe no-op when missing or not loaded. */
export function reachGoal(goal: Goal) {
  try {
    const id = Number(process.env.NEXT_PUBLIC_YM_ID);
    const ym = (globalThis as unknown as { ym?: Ym }).ym;
    if (id && typeof ym === "function") ym(id, "reachGoal", goal);
  } catch {
    /* analytics must never break the UI */
  }
  try {
    const gtag = (globalThis as unknown as { gtag?: Gtag }).gtag;
    if (process.env.NEXT_PUBLIC_GA_ID && typeof gtag === "function") gtag("event", GA_NAMES[goal]);
  } catch {
    /* ignore */
  }
}

/** Fires a goal at most once per browser (e.g. first_lesson). */
export function reachGoalOnce(goal: Goal) {
  try {
    const key = `pigsen_goal_${goal}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    /* storage blocked: still send */
  }
  reachGoal(goal);
}
