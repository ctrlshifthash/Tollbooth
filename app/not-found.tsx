import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Compass className="size-7" />
      </div>
      <p className="font-mono text-sm text-blue-300">404</p>
      <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page you're looking for doesn't exist. Head back to the registry to discover x402 services.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/">
          <Button variant="outline">Go home</Button>
        </Link>
        <Link href="/services">
          <Button>Explore services</Button>
        </Link>
      </div>
    </div>
  );
}
