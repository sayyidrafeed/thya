"use client";

import { m } from "motion/react";
import { Fragment } from "react";

import { type InlineSegment, parseWhatsAppText } from "@/lib/whatsapp/format";

// One word of a streamed reply. It follows the "hidden"/"shown" variants of the bubble around it,
// so the words stagger in like a reply being written.
const wordVariants = {
  hidden: { opacity: 0, filter: "blur(3px)" },
  shown: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.28 } },
};

function Words({ text, stream }: { text: string; stream: boolean }) {
  if (!stream) return text;

  return text.split(/(\s+)/).map((part, index) =>
    part.trim() === "" ? (
      // oxlint-disable-next-line react/no-array-index-key -- a fixed string split; position is identity
      <Fragment key={index}>{part}</Fragment>
    ) : (
      // oxlint-disable-next-line react/no-array-index-key -- a fixed string split; position is identity
      <m.span key={index} variants={wordVariants} className="inline-block">
        {part}
      </m.span>
    ),
  );
}

function Inline({ segments, stream }: { segments: InlineSegment[]; stream: boolean }) {
  return segments.map((segment) =>
    segment.bold ? (
      <strong key={segment.id} className="font-semibold">
        <Words text={segment.text} stream={stream} />
      </strong>
    ) : (
      <span key={segment.id}>
        <Words text={segment.text} stream={stream} />
      </span>
    ),
  );
}

export function ChatText({ text, stream = false }: { text: string; stream?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {parseWhatsAppText(text).map((block) =>
        block.kind === "list" ? (
          <ul key={block.id} className="flex list-disc flex-col gap-1 pl-4">
            {block.items.map((item) => (
              <li key={item[0]?.id ?? block.id}>
                <Inline segments={item} stream={stream} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={block.id}>
            {block.lines.map((line) => (
              <span key={line[0]?.id ?? block.id} className="block">
                <Inline segments={line} stream={stream} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
