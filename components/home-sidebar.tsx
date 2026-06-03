"use client";

import * as React from "react";

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "capabilities", label: "Capabilities" },
  { id: "how", label: "How it works" },
  { id: "agents", label: "Agents" },
  { id: "why", label: "Why Base" },
  { id: "featured", label: "Services" },
  { id: "market", label: "Marketplace" },
];

// Sticky scroll-spy nav for the home page. Highlights the section in view and
// jumps to any section on click. Desktop only (xl+), out of the way on mobile.
export function HomeSidebar() {
  const [active, setActive] = React.useState<string>(SECTIONS[0].id);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      // Trigger when a section is around the vertical middle of the viewport.
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Page sections"
      className="fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 rounded-xl border border-white/10 bg-background/80 p-3 shadow-xl backdrop-blur-md xl:flex"
    >
      {SECTIONS.map((s) => {
        const on = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`group flex items-center gap-3 rounded-lg py-1.5 pr-2 text-sm transition-colors ${
              on ? "font-medium text-white" : "text-muted-foreground hover:text-white"
            }`}
          >
            <span
              className={`h-px rounded-full transition-all duration-300 ${
                on ? "w-9 bg-[#0000ff]" : "w-4 bg-white/30 group-hover:w-7 group-hover:bg-white/60"
              }`}
            />
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
