import { redirect } from "next/navigation";

// Discover has been merged into the unified Services page (import + directory).
export default function DiscoverRedirect() {
  redirect("/services");
}
