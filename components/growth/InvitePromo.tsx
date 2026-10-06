import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** "Invite a friend" banner in the style of ProPromo. */
export function InvitePromo() {
  return (
    <Link href="/invite" className="card pro-promo growth-promo" data-testid="invite-promo">
      <span className="pro-promo-ic">
        <Icon name="users" />
      </span>
      <span className="pro-promo-body">
        <b>Пригласи друга и получи 7 дней Pro</b>
        <span>Другу 200 PigCoin$ сразу, тебе 500 PigCoin$ и неделя Pro, когда он пройдёт первый урок. Каждый 5-й друг: ещё +30 дней Pro.</span>
      </span>
      <span className="btn btn-accent btn-sm pro-promo-cta">Пригласить</span>
    </Link>
  );
}
