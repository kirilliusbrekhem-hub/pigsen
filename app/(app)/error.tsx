"use client";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/States";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState
        icon="alert"
        title="Не удалось загрузить страницу"
        text="Похоже, что-то пошло не так на нашей стороне. Попробуйте ещё раз."
        action={
          <button className="btn btn-primary" onClick={reset}>
            Повторить
          </button>
        }
      />
    </div>
  );
}
