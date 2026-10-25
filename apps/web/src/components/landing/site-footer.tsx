import { AsciiField } from "@/components/landing/ascii-field";

const columns = [
  {
    title: "Thya",
    items: [
      { label: "Meet Thya", href: "#meet-thya" },
      { label: "How it works", href: "#how-it-works" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Indy · Team Lead & Business" },
      { label: "Nawra · Product & Research Lead" },
      { label: "Rafee · Tech Lead & Engineer" },
    ],
  },
  {
    title: "Built for",
    items: [{ label: ".id DeveloperDay 2026" }, { label: "Road to APICTA" }],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="relative isolate flex min-h-96 items-center justify-center overflow-hidden px-4 py-20">
        <AsciiField />
        <div className="flex max-w-md flex-col items-center gap-4 rounded-card border border-line bg-surface/95 px-6 py-8 text-center shadow-card backdrop-blur-sm sm:px-10">
          <p className="text-title font-medium text-balance">
            Ask how your shop did today. Get the answer in a chat.
          </p>
          <p className="text-caption text-pretty text-ink-muted">
            Thya is a prototype. The answers on this page come from it, using sample data.
          </p>
          <a
            href="#top"
            className="inline-flex min-h-11 items-center rounded-control bg-ink px-5 text-caption font-medium text-surface transition-colors hover:bg-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Back to the top
          </a>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-page gap-10 border-t border-line px-4 pt-14 pb-10 sm:grid-cols-3 sm:px-6">
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="font-mono text-label text-ink-muted uppercase">{column.title}</h2>
            <ul className="mt-4 flex flex-col gap-2 text-caption">
              {column.items.map((item) => (
                <li key={item.label}>
                  {"href" in item ? (
                    <a
                      href={item.href}
                      className="inline-flex min-h-6 items-center transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-page flex-col gap-2 px-4 pb-10 text-caption text-ink-muted sm:flex-row sm:justify-between sm:px-6">
        <p>© 2026 Thya · thya.veterantech.id</p>
        <p>The language model runs on servers in Indonesia.</p>
      </div>
    </footer>
  );
}
