import { m } from "motion/react";

import { ChatBubble } from "@/components/chat/chat-bubble";
import type { ChatLine } from "@/lib/landing/conversations";

export function PhoneMockup({ lines }: { lines: readonly ChatLine[] }) {
  return (
    <div className="mx-auto flex aspect-phone w-full max-w-phone flex-col overflow-hidden rounded-phone border-8 border-ink bg-chat shadow-phone">
      <div className="flex items-center gap-3 bg-brand px-4 py-3 text-on-brand">
        <span aria-hidden className="size-9 rounded-full bg-on-brand" />
        <span className="text-body font-medium">Thya</span>
      </div>
      <ol aria-label="Example conversation with Thya" className="flex flex-1 flex-col gap-2 p-3">
        {lines.map((line, index) => (
          <m.li
            key={line.id}
            className="flex flex-col"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.35, ease: "easeOut" }}
          >
            <ChatBubble side={line.side} text={line.text} />
          </m.li>
        ))}
      </ol>
    </div>
  );
}
