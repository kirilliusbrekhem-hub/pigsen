import { PageSkeleton } from "@/components/ui/PageSkeleton";

// Scoped to the index page only: a loading boundary above the [id] routes would start streaming
// before notFound() runs, turning missing ids into soft 404s with status 200.
export default function Loading() {
  return <PageSkeleton />;
}
