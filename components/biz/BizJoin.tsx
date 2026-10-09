"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";

export function BizJoin({ code, name, kindTitle, founder, members, full }: { code: string; name: string; kindTitle: string; founder: string; members: string[]; full: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function join() {
    setBusy(true);
    setError("");
    try {
      await api("/api/biz/join", { method: "POST", body: { code } });
      router.push("/biz");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="biz stack biz-join">
      <section className="card card-pad stack">
        <span className="label">Приглашение в бизнес</span>
        <h1>
          {founder} зовёт вас в «{name}»
        </h1>
        <p className="muted">
          {kindTitle}. В команде: {members.join(", ")} и $PIG. Ваши новые взносы в копилку будут растить общий капитал — а снятия будут видны всей команде.
        </p>
        {error && <p className="biz-error">{error}</p>}
        <Button variant="primary" loading={busy} disabled={full} onClick={join}>
          {full ? "Команда заполнена" : "Стать сооснователем"}
        </Button>
      </section>
    </div>
  );
}
