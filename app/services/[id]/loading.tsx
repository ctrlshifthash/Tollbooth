import { Skeleton } from "@/components/ui/skeleton";

export default function ServiceDetailLoading() {
  return (
    <div className="container py-10">
      <Skeleton className="h-5 w-32" />
      <div className="mt-6 flex justify-between gap-6">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full max-w-2xl" />
        </div>
        <Skeleton className="size-28 rounded-xl" />
      </div>
      <Skeleton className="mt-8 h-11 w-full" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
