"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

import { useFaqOpen } from "@/hooks/use-faq-open";
import { faqs } from "@/lib/landing/faq";

const ease = [0.22, 1, 0.36, 1] as const;

const row = {
  hidden: { opacity: 0, transform: "translateY(8px)" },
  shown: { opacity: 1, transform: "translateY(0px)" },
};

export function Faq() {
  const { isOpen, toggle, reduceMotion } = useFaqOpen();

  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto grid w-full max-w-page scroll-mt-16 grid-cols-1 gap-10 px-4 py-section sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-0"
    >
      <div className="md:border-r md:border-line md:pr-12">
        <p className="mb-4 font-mono text-label text-brand uppercase">FAQ</p>
        <h2 id="faq-title" className="text-display font-medium text-balance md:text-display-wide">
          Questions owners ask us.
        </h2>
      </div>
      <m.div
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: "0px 0px -80px 0px" }}
        transition={{ staggerChildren: 0.05 }}
        className="flex flex-col md:pl-12"
      >
        {faqs.map((faq, index) => {
          const open = isOpen(index);
          const buttonId = `faq-question-${index}`;
          const panelId = `faq-answer-${index}`;

          return (
            <m.div
              key={faq.question}
              variants={row}
              transition={{ duration: 0.3, ease }}
              data-open={open}
              className="group border-b border-line first:border-t md:first:border-t-0"
            >
              <h3 className="text-body font-medium">
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 py-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {faq.question}
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-muted transition-transform duration-200 ease-out-soft group-data-[open=true]:rotate-180"
                  />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open ? (
                  <m.div
                    key="answer"
                    id={panelId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: reduceMotion ? 0 : 0.22, ease },
                      opacity: { duration: 0.18, ease },
                    }}
                    className="overflow-hidden"
                  >
                    <m.p
                      initial={{ transform: "translateY(-4px)" }}
                      animate={{ transform: "translateY(0px)" }}
                      transition={{ duration: 0.22, ease }}
                      className="pb-5 text-pretty text-ink-muted"
                    >
                      {faq.answer}
                    </m.p>
                  </m.div>
                ) : null}
              </AnimatePresence>
            </m.div>
          );
        })}
      </m.div>
    </section>
  );
}
