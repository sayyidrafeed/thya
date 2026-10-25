"use client";

import { useScrolledPast } from "@/hooks/use-scrolled-past";

const links = [
  { href: "#meet-thya", label: "Meet Thya" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

// Full-width bar at the top of the page; once scrolled it settles into a floating glass pill.
export function SiteHeader() {
  const scrolled = useScrolledPast(24);

  return (
    <header className="fixed inset-x-0 top-0 z-30 px-3 sm:px-4">
      <nav
        aria-label="Main"
        data-scrolled={scrolled}
        className="mx-auto mt-0 flex h-16 w-full max-w-page items-center justify-between rounded-none px-2 transition-all duration-500 ease-out-soft data-[scrolled=true]:mt-3 data-[scrolled=true]:h-14 data-[scrolled=true]:max-w-3xl data-[scrolled=true]:rounded-control data-[scrolled=true]:glass data-[scrolled=true]:px-3 motion-reduce:transition-none sm:px-4"
      >
        <a
          href="#top"
          className="flex min-h-11 items-center gap-2 rounded-control px-1 text-title font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-brand text-caption text-on-brand"
          >
            T
          </span>
          Thya
        </a>
        <ul className="flex items-center gap-1">
          {links.map((link) => (
            <li key={link.href} className="hidden first:block sm:block">
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-control px-3 text-caption text-ink-muted transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#developerday"
              className="ml-1 inline-flex min-h-10 items-center rounded-control bg-ink px-4 text-caption font-medium text-surface transition-colors hover:bg-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              DeveloperDay
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
