"use client";
import { useEffect } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/States";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="not-found">
      <EmptyState
        icon="alert"
        title="Что-то пошло не так"
        text={`Мы уже записали ошибку и разберёмся.${error.digest ? ` Код: ${error.digest}` : ""}`}
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={reset}>Повторить</button>
            <Link className="btn" href="/">На главную</Link>
          </div>
        }
      />
    </div>
  );
}
