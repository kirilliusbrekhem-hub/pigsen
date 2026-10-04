import Link from "next/link";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <div className="not-found">
      <EmptyState icon="compass" title="Страница не найдена" text="Проверьте адрес или вернитесь на главную." action={<Link className="btn btn-primary" href="/">На главную</Link>} />
    </div>
  );
}
