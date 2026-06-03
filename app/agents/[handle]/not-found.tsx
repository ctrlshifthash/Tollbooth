import Link from "next/link";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function AgentNotFound() {
  return (
    <div className="container py-24">
      <EmptyState
        icon={<UserX className="size-6" />}
        title="Agent not found"
        description="No agent or developer profile matches this handle."
        action={
          <Link href="/agents">
            <Button>Browse all agents</Button>
          </Link>
        }
      />
    </div>
  );
}
