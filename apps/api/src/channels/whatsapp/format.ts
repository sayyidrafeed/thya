// Decision U4: WhatsApp formatting is fixed by code, every time, instead of trusting the prompt rule
// (the model still writes **Rp4.100.000** now and then). WhatsApp knows *bold*, _italic_, ~strike~
// and ``` blocks; headings, tables and links are flattened into plain lines.

const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function flattenTableRow(line: string): string {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(" - ");
}

function formatLine(line: string): string {
  if (/^\s*\|.*\|\s*$/.test(line)) return flattenTableRow(line);

  return line
    .replace(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/, "*$1*")
    .replace(/^(\s*)[*+]\s+/, "$1- ")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/__(.+?)__/g, "_$1_")
    .replace(/~~(.+?)~~/g, "~$1~")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*+/g, "*");
}

export function toWhatsAppText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !TABLE_DIVIDER.test(line))
    .map(formatLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Splits at a paragraph, then a line, then a space, so no piece passes `limit` characters.
export function splitText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];

  const window = text.slice(0, limit);

  const cut = [window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" ")].find(
    (index) => index > limit / 2,
  );

  const at = cut ?? limit;

  return [text.slice(0, at).trimEnd(), ...splitText(text.slice(at).trimStart(), limit)];
}
