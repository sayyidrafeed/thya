import type { ChatSide } from "@/lib/landing/conversations";
import { parseWhatsAppText, type InlineSegment } from "@/lib/whatsapp/format";

function Inline({ segments }: { segments: InlineSegment[] }) {
  return segments.map((segment) =>
    segment.bold ? (
      <strong key={segment.id}>{segment.text}</strong>
    ) : (
      <span key={segment.id}>{segment.text}</span>
    ),
  );
}

function BubbleText({ text }: { text: string }) {
  return parseWhatsAppText(text).map((block) =>
    block.kind === "list" ? (
      <ul key={block.id} className="list-disc pl-5">
        {block.items.map((item) => (
          <li key={item[0]?.id ?? block.id}>
            <Inline segments={item} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={block.id}>
        {block.lines.map((line) => (
          <span key={line[0]?.id ?? block.id} className="block">
            <Inline segments={line} />
          </span>
        ))}
      </p>
    ),
  );
}

export function ChatBubble({ side, text }: { side: ChatSide; text: string }) {
  return (
    <div
      data-side={side}
      className="flex max-w-[85%] flex-col gap-1 rounded-bubble bg-bubble-in px-3 py-2 text-chat text-ink shadow-card data-[side=out]:self-end data-[side=out]:bg-bubble-out"
    >
      <BubbleText text={text} />
    </div>
  );
}
