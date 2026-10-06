import type { Metadata } from "next";
import { InviteLink } from "@/components/growth/InviteLink";
import { InvitePromo } from "@/components/growth/InvitePromo";
import { ReviewForm } from "@/components/growth/ReviewForm";
import { Coin } from "@/components/ui/Coin";
import { requireUser } from "@/lib/auth/session";
import { REFERRAL, referralStats } from "@/lib/growth/referral";
import { REVIEW_REWARD, myReview } from "@/lib/growth/reviews";

export const metadata: Metadata = { title: "Пригласи друга" };

export default async function InvitePage() {
  const user = await requireUser();
  const [stats, review] = await Promise.all([referralStats(user.id), myReview(user.id)]);
  const path = `/register?ref=${user.id}`;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <span className="label">Бонусы</span>
          <h1>Пригласи друга</h1>
        </div>
      </div>

      <InvitePromo />

      <section className="card card-pad stack" style={{ gap: 14 }}>
        <b>Ваша ссылка</b>
        <InviteLink path={path} />
        <div className="growth-stats">
          <div><span className="label">Пришли</span><b className="num">{stats.invited}</b></div>
          <div><span className="label">Прошли урок</span><b className="num">{stats.activated}</b></div>
          <div><span className="label">Заработано</span><b className="num">{stats.coins} <Coin /></b></div>
          <div><span className="label">Дней Pro</span><b className="num">{stats.proDays}</b></div>
        </div>
        <p className="muted">До бонуса +{REFERRAL.milestoneProDays} дней Pro осталось друзей: {stats.toNextMilestone}</p>
      </section>

      <section className="card card-pad stack" style={{ gap: 10 }}>
        <b>Правила</b>
        <ol className="growth-rules">
          <li>Отправьте другу свою ссылку. Ссылка помнит вас 30 дней, даже если друг зарегистрируется не сразу.</li>
          <li>Друг сразу после регистрации получает {REFERRAL.inviteeBonus} PigCoin$ («Бонус за приглашение»).</li>
          <li>Когда друг пройдёт свой первый урок, вы получите {REFERRAL.inviterCoins} PigCoin$ и {REFERRAL.inviterProDays} дней Pro.</li>
          <li>За каждого 5-го такого друга дополнительно +{REFERRAL.milestoneProDays} дней Pro.</li>
          <li>Награда платится максимум за {REFERRAL.maxRewardedPer30d} друзей за 30 дней. Остальные тоже засчитываются в статистику.</li>
          <li>Приглашать самого себя и заблокированные аккаунты нельзя: такие приглашения не засчитываются.</li>
        </ol>
      </section>

      <section className="card card-pad stack" style={{ gap: 12 }} id="review">
        <div className="stack" style={{ gap: 4 }}>
          <b>Отзыв за награду</b>
          <span className="muted">
            Напишите честный отзыв о PIGSEN. После проверки модератором: {REVIEW_REWARD.coins} PigCoin$ и {REVIEW_REWARD.proDays} дня Pro. Один отзыв на аккаунт.
          </span>
        </div>
        <ReviewForm initial={review ? { rating: review.rating, text: review.text, status: review.status } : null} />
      </section>
    </div>
  );
}
