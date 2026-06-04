export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="container py-6 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Tollbooth. Built on Base.</p>
      </div>
    </footer>
  );
}
