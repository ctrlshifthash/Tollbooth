import { Skeleton } from "@/components/ui/skeleton";

export default function ListLoading() {
  return (
    <div className="container max-w-3xl py-12">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-8 space-y-6">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
