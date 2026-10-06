import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Paywall shown in place of exclusive Pro content. */
export function PremiumLock({ what = "материал" }: { what?: string }) {
  return (
    <div className="premium-lock" data-testid="premium-lock">
      <span className="premium-lock-ic">
        <Icon name="lock" />
      </span>
      <b>Эксклюзивный {what} PIGSEN Pro</b>
      <p className="muted">Полная версия открыта в Pro вместе с безлимитным $PIG, x2 PigCoin$ и всеми премиум-курсами.</p>
      <Link className="btn btn-accent" href="/pro">
        <Icon name="sparkle" size="sm" /> Открыть с Pro
      </Link>
    </div>
  );
}

export function ProChip() {
  return (
    <span className="pro-badge" title="Эксклюзив Pro">
      Pro
    </span>
  );
}
