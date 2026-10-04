import { Skeleton } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="ai-shell" aria-busy="true">
      <div className="ai-main">
        <div className="ai-thread" style={{ width: "100%" }}>
          <Skeleton h={14} w={160} style={{ marginTop: 40 }} />
          <Skeleton h={40} w="80%" />
          <div className="prompt-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} h={64} r={14} />
            ))}
          </div>
        </div>
      </div>
      <aside className="ctx">
        <Skeleton h={14} w={100} />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} h={40} r={9} />
        ))}
      </aside>
    </div>
  );
}
