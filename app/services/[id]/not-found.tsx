import Link from "next/link";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function ServiceNotFound() {
  return (
    <div className="container py-24">
      <EmptyState
        icon={<PackageX className="size-6" />}
        title="Service not found"
        description="This service doesn't exist or may have been removed from the registry."
        action={
          <Link href="/services">
            <Button>Browse all services</Button>
          </Link>
        }
      />
    </div>
  );
}
