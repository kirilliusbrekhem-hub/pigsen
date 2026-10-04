import Link from "next/link";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState icon="compass" title="Страница не найдена" text="Возможно, материал был удалён или ссылка устарела." action={<Link className="btn btn-primary" href="/dashboard">На главную</Link>} />
    </div>
  );
}
