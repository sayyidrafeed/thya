import { type InlineSegment, parseWhatsAppText } from "@/lib/whatsapp/format";

function Inline({ segments }: { segments: InlineSegment[] }) {
  return segments.map((segment) =>
    segment.bold ? (
      <strong key={segment.id} className="font-semibold">
        {segment.text}
      </strong>
    ) : (
      <span key={segment.id}>{segment.text}</span>
    ),
  );
}

export function ChatText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {parseWhatsAppText(text).map((block) =>
        block.kind === "list" ? (
          <ul key={block.id} className="flex list-disc flex-col gap-1 pl-4">
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
      )}
    </div>
  );
}
