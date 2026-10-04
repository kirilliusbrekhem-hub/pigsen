"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/client/api";
import { xpMessage } from "@/lib/client/xp";
import type { XpResultDTO } from "@/types";

interface Props {
  lessonId: string;
  completed: boolean;
  nextHref: string | null;
  courseHref: string;
  isLast: boolean;
}

export function CompleteLessonButton({ lessonId, completed: initial, nextHref, courseHref, isLast }: Props) {
  const [completed, setCompleted] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  async function set(next: boolean) {
    setLoading(true);
    try {
      const r = await api<{ xp?: XpResultDTO }>(`/api/lessons/${lessonId}/complete`, { method: next ? "POST" : "DELETE" });
      setCompleted(next);
      if (next) {
        toast.show(xpMessage(r.xp, isLast ? "Курс завершён. Отличная работа!" : "Урок завершён."), {
          action: nextHref ? { label: "Дальше", onClick: () => router.push(nextHref) } : { label: "К курсу", onClick: () => router.push(courseHref) },
        });
      }
      startTransition(() => router.refresh());
    } catch (e) {
      toast.show(errorMessage(e), { kind: "err" });
    } finally {
      setLoading(false);
    }
  }

  if (completed) {
    return (
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" className="is-success" onClick={() => set(false)} loading={loading} title="Отметить как непройденный">
          <Icon name="check" size="sm" /> Урок пройден
        </Button>
        {nextHref ? (
          <Button variant="primary" onClick={() => router.push(nextHref)}>
            Следующий урок <Icon name="arrow" size="sm" />
          </Button>
        ) : (
          <Button variant="primary" onClick={() => router.push(courseHref)}>
            К курсу <Icon name="arrow" size="sm" />
          </Button>
        )}
      </div>
    );
  }
  return (
    <Button variant="accent" onClick={() => set(true)} loading={loading}>
      <Icon name="check" size="sm" /> Отметить как завершённый
    </Button>
  );
}
