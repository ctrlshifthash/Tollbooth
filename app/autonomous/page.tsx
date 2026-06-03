import { redirect } from "next/navigation";

// Autonomous agents now live on the unified Agents page.
export default function AutonomousRedirect() {
  redirect("/agents");
}
