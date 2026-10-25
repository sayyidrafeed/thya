export type InlineSegment = { id: string; text: string; bold: boolean };

export type TextBlock =
  | { id: string; kind: "paragraph"; lines: InlineSegment[][] }
  | { id: string; kind: "list"; items: InlineSegment[][] };

const boldPattern = /\*([^*\n]+)\*/g;
const listMarker = /^\s*-\s+/;

export function parseInline(line: string, lineId: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;

  for (const match of line.matchAll(boldPattern)) {
    if (match.index > cursor) {
      segments.push({
        id: `${lineId}:${cursor}`,
        text: line.slice(cursor, match.index),
        bold: false,
      });
    }

    segments.push({ id: `${lineId}:${match.index}`, text: match[1] ?? "", bold: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    segments.push({ id: `${lineId}:${cursor}`, text: line.slice(cursor), bold: false });
  }

  return segments;
}

export function parseWhatsAppText(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];

  for (const [index, line] of text.split("\n").entries()) {
    const lineId = String(index);
    const last = blocks.at(-1);

    if (line.trim() === "") {
      blocks.push({ id: lineId, kind: "paragraph", lines: [] });
      continue;
    }

    if (listMarker.test(line)) {
      const item = parseInline(line.replace(listMarker, ""), lineId);

      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ id: lineId, kind: "list", items: [item] });

      continue;
    }

    const inline = parseInline(line, lineId);

    if (last?.kind === "paragraph" && last.lines.length > 0) last.lines.push(inline);
    else blocks.push({ id: lineId, kind: "paragraph", lines: [inline] });
  }

  return blocks.flatMap((block) =>
    block.kind === "paragraph" && block.lines.length === 0 ? [] : [block],
  );
}
