import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="stack" style={{ gap: 28 }} aria-busy="true" aria-label="Загрузка">
      <div className="stack" style={{ gap: 10 }}>
        <Skeleton h={12} w={120} />
        <Skeleton h={34} w="45%" />
      </div>
      <Skeleton h={180} r={24} />
      <div className="grid cols-3">
        <Skeleton h={150} r={18} />
        <Skeleton h={150} r={18} />
        <Skeleton h={150} r={18} />
      </div>
    </div>
  );
}
