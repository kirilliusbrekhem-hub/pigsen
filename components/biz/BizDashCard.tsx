import Link from "next/link";
import { bizSummary } from "@/lib/biz/service";
import { Icon } from "@/components/ui/Icon";

/** Prominent "Мой бизнес" entry on the dashboard. */
export async function BizDashCard({ userId }: { userId: string }) {
  const s = await bizSummary(userId).catch(() => null);
  return (
    <Link href="/biz" className="biz-dash" data-testid="biz-dash">
      <span className="biz-dash-ic">
        <Icon name="store" />
      </span>
      <span className="biz-dash-body">
        <span className="label">Мой бизнес</span>
        {s ? (
          <>
            <b>
              {s.name} · {s.levelName}
            </b>
            <span>
              Капитал {s.capital.toLocaleString("ru-RU")} ₽ · рейтинг {s.rating.toFixed(1)} ★ · {s.members > 1 ? `команда ${s.members} чел.` : "соло"}
            </span>
          </>
        ) : (
          <>
            <b>Откройте кофейню, которая растёт из копилки</b>
            <span>Каждый взнос в копилку — капитал вашего бизнеса. CAP — сооснователь.</span>
          </>
        )}
      </span>
      <Icon name="arrow" className="biz-dash-go" />
    </Link>
  );
}
