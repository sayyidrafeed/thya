import { FooterArt } from "@/components/landing/footer-art";
import { ThyaMark } from "@/components/ui/thya-mark";

const columns = [
  {
    title: "Thya",
    items: [
      { label: "Meet Thya", href: "#meet-thya" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Playground", href: "#playground" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Indy · Product Owner", href: "https://www.linkedin.com/in/indy-agustin/" },
      { label: "Nawra · Business Analyst", href: "https://www.linkedin.com/in/nawra-illona/" },
      { label: "Rafee · AI Engineer", href: "https://www.linkedin.com/in/m-sayyid-rafee-djamil/" },
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
    <footer className="relative isolate overflow-hidden border-t border-line">
      <div className="mx-auto grid w-full max-w-page grid-cols-2 gap-x-6 gap-y-10 px-4 pt-16 pb-8 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-2 flex max-w-xs flex-col gap-3 md:col-span-1">
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
            <ul className="mt-2 flex flex-col text-caption text-ink-muted md:mt-3 md:gap-2">
              {column.items.map((item) => (
                <li key={item.label} className="flex min-h-11 items-center md:min-h-0">
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
      <FooterArt />
    </footer>
  );
}
