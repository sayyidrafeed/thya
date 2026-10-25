import { ChevronDown } from "lucide-react";

import { faqs } from "@/lib/landing/faq";

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto grid w-full max-w-page scroll-mt-16 gap-10 px-4 py-section sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-0"
    >
      <div className="md:border-r md:border-line md:pr-12">
        <p className="mb-4 font-mono text-label text-brand uppercase">FAQ</p>
        <h2 id="faq-title" className="text-display font-medium text-balance md:text-display-wide">
          Questions owners ask us.
        </h2>
      </div>
      <div className="flex flex-col md:pl-12">
        {faqs.map((faq, index) => (
          <details
            key={faq.question}
            open={index === 0}
            className="group border-b border-line first:border-t md:first:border-t-0"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              {faq.question}
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <p className="pb-5 text-pretty text-ink-muted">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
