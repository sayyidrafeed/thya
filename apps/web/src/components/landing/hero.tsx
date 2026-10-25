import { ButtonLink } from "@/components/ui/button-link";

// PLACEHOLDER copy until the landing brief; claims must match what /demo can show today.
export function Hero() {
  return (
    <section className="mx-auto flex max-w-page flex-col items-center gap-6 px-4 py-section text-center">
      <h1 className="max-w-prose text-display text-balance">
        Your business assistant, right in WhatsApp
      </h1>
      <p className="max-w-prose text-body text-pretty text-ink-muted">
        Thya answers questions about your shop&apos;s sales in everyday language, using your own
        numbers.
      </p>
      <ButtonLink href="/demo" variant="brand">
        Try the demo
      </ButtonLink>
    </section>
  );
}
