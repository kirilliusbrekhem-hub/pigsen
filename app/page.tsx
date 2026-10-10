import type { Metadata } from "next";
import { Landing } from "@/components/kapital/Landing";
import { PLANS } from "@/lib/billing/plan";

export const metadata: Metadata = {
  title: { absolute: "Kapital — Savings that start businesses." },
  description: "Опиши идею, и ИИ соберёт бизнес за минуту. Он растёт от твоих реальных накоплений, пока ты не запустишь его по-настоящему. CAP — твой ИИ-сооснователь.",
  openGraph: { title: "Kapital — Savings that start businesses.", description: "Опиши идею, и ИИ соберёт бизнес за минуту. Он растёт от твоих реальных накоплений.", locale: "ru_RU", type: "website" },
};

// Logged-in visitors are redirected to /business by proxy.ts.
export default function Home() {
  return <Landing prices={{ pro: PLANS.month.stars, pro10: PLANS.month10.stars }} />;
}
