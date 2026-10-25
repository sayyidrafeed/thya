import { FooterLandscape } from "@/components/landing/footer-landscape";
import { ThyaMark } from "@/components/ui/thya-mark";

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
    items: [
      { label: ".id DeveloperDay 2026", href: "https://developerday.id" },
      { label: "Road to APICTA" },
    ],
  },
] as const;

const linkClass =
  "inline-flex items-center transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-sky">
      <div className="mx-auto grid w-full max-w-page gap-10 px-4 pt-16 pb-72 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:pb-96">
        <div className="flex max-w-xs flex-col gap-3">
          <p className="flex items-center gap-2 text-title font-semibold">
            <ThyaMark size="md" />
            Thya
          </p>
          <p className="text-caption text-pretty text-ink-muted">
            Ask how your shop did today. Get the answer in a chat.
          </p>
          <p className="text-caption text-ink-muted">
            © 2026 Thya · The language model runs on servers in Indonesia.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-caption font-semibold">{column.title}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-caption text-ink-muted">
              {column.items.map((item) => (
                <li key={item.label}>
                  {"href" in item ? (
                    <a
                      href={item.href}
                      className={linkClass}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noreferrer" : undefined}
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
      <FooterLandscape />
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-[0.12em] text-center text-wordmark font-semibold text-surface/85 select-none md:text-wordmark-md xl:text-wordmark-xl"
      >
        Thya
      </p>
    </footer>
  );
}
