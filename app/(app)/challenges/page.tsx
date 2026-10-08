import { Disclaimer, RISKY_CATEGORIES } from "@/components/legal/Disclaimer";
import type { Metadata } from "next";
import { requireUserWith } from "@/lib/auth/session";
import { isPro } from "@/lib/billing/plan";
import { ProPromo } from "@/components/pro/ProPromo";
import { ChallengeList, type DoneInfo } from "@/components/social/ChallengeList";
import { CHALLENGES, FREE_CHALLENGES } from "@/lib/social/challenges";
import { doneChallenges } from "@/lib/social/service";

export const metadata: Metadata = { title: "Челленджи" };

export default async function ChallengesPage() {
  const [user, done] = await requireUserWith(doneChallenges);
  const pro = isPro(user.profile);
  const doneMap: Record<string, DoneInfo> = {};
  for (const [id, d] of done) doneMap[id] = { note: d.note, date: d.createdAt.toISOString() };
  return (
    <>
      <section className="page-head">
        <div>
          <span className="label">Офлайн-челленджи</span>
          <h1>Знания в реальной жизни</h1>
          <p>Выполняйте задания вне экрана, коротко расскажите, как прошло, и получайте PigCoin$. Так уроки превращаются в привычки.</p>
        </div>
        <div className="ch-progress">
          <b>{done.size}</b>
          <span className="muted">из {CHALLENGES.length} выполнено</span>
        </div>
      </section>
      <Disclaimer kind="challenge" />
      {!pro && <ProPromo place="challenges" note={`На Free доступны ${FREE_CHALLENGES} челленджа.`} />}
      <ChallengeList done={doneMap} pro={pro} />
    </>
  );
}
