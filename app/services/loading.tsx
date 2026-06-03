import { Skeleton } from "@/components/ui/skeleton";

export default function ServicesLoading() {
  return (
    <div className="container py-12">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
