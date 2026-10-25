const links = [
  { href: "#meet-thya", label: "Meet Thya" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-surface/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-page items-center justify-between px-4 sm:px-6"
      >
        <a
          href="#top"
          className="flex min-h-11 items-center gap-2 text-title font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-full bg-brand text-caption text-on-brand"
          >
            T
          </span>
          Thya
        </a>
        <ul className="flex items-center gap-1 sm:gap-2">
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
        </ul>
      </nav>
    </header>
  );
}
