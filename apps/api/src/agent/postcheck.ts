// Every number in a reply must come from this turn's evidence: tool results, tool arguments,
// the owner's own messages, and business facts. Shared by the runtime check and the eval grader.

type Reading = { value: number; decimals: number; scale: number };

type Time = { hour: number; minute: number };

export type UngroundedNumber = { text: string; sentence: string };

// "M" (miliar) is case-sensitive so "5 m" (metres) never reads as five billion.
const SCALES = new Map([
  ["rb", 1e3],
  ["ribu", 1e3],
  ["k", 1e3],
  ["jt", 1e6],
  ["juta", 1e6],
  ["M", 1e9],
  ["miliar", 1e9],
]);

const TIME = /(?<![\d.,])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d.,]*\d)/g;

// "1.250.000" (thousands), "56,3" (decimal comma), "2.5" (decimal point), "1,2 jt" (scaled).
const NUMBER =
  /(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+(?:\.\d{1,2}(?!\d))?)(?:,(\d+))?(?:\s?(rb|ribu|k|jt|juta|miliar|M)\b)?/g;

// JSON numbers such as 56.3; thousand-grouped text ("3.000") is left to NUMBER so it never reads as 3.
const PLAIN_NUMBER = /(?<![\d.,])\d+(?:\.\d+)?(?![\d.,]*\d)/g;
const THOUSANDS = /^\d{1,3}(\.\d{3})+$/;
const LIST_MARKER = /^\s*\d+[.)]\s/gm;

function readNumber(match: RegExpExecArray): Reading {
  const [, whole = "", fraction, unit] = match;
  const scale = unit ? (SCALES.get(unit) ?? 1) : 1;

  if (fraction !== undefined)
    return {
      value: Number(`${whole.replaceAll(".", "")}.${fraction}`),
      decimals: fraction.length,
      scale,
    };

  if (THOUSANDS.test(whole))
    return { value: Number(whole.replaceAll(".", "")), decimals: 0, scale };

  const [, decimalPart = ""] = whole.split(".");

  return { value: Number(whole), decimals: decimalPart.length, scale };
}

function timesIn(text: string): Time[] {
  return [...text.matchAll(TIME)].map(([, hour, minute]) => ({
    hour: Number(hour),
    minute: Number(minute),
  }));
}

function evidenceValues(evidence: readonly string[]): number[] {
  return evidence.flatMap((text) => [
    ...[...text.matchAll(NUMBER)].map((match) => {
      const { value, scale } = readNumber(match);

      return value * scale;
    }),
    ...[...text.matchAll(PLAIN_NUMBER)].flatMap(([raw]) =>
      THOUSANDS.test(raw) ? [] : [Number(raw)],
    ),
  ]);
}

function isGrounded({ value, decimals, scale }: Reading, known: number[]): boolean {
  const factor = 10 ** decimals;

  return known.some(
    (candidate) =>
      Math.round((Math.abs(candidate) / scale) * factor) === Math.round(value * factor),
  );
}

function sentenceAt(reply: string, index: number): string {
  const start = Math.max(
    reply.lastIndexOf("\n", index),
    ...[". ", "! ", "? "].map((end) => reply.lastIndexOf(end, index)),
  );

  const ends = ["\n", ". ", "! ", "? "].flatMap((end) => {
    const at = reply.indexOf(end, index);

    return at === -1 ? [] : [at];
  });

  return reply.slice(start + 1, ends.length > 0 ? Math.min(...ends) + 1 : reply.length).trim();
}

export function ungroundedNumbers(reply: string, evidence: readonly string[]): UngroundedNumber[] {
  const knownValues = evidenceValues(evidence);
  const knownTimes = evidence.flatMap(timesIn);
  const ungrounded: UngroundedNumber[] = [];
  // Blank out list markers and times so the number pass never reads "15.00" as fifteen.
  let rest = reply.replace(LIST_MARKER, (marker) => " ".repeat(marker.length));

  for (const match of rest.matchAll(TIME)) {
    const [text, hour, minute] = match;

    // "10.50" may be a decimal rather than a clock time, so either reading can ground it.
    const grounded =
      knownTimes.some((time) => time.hour === Number(hour) && time.minute === Number(minute)) ||
      isGrounded({ value: Number(`${hour}.${minute}`), decimals: 2, scale: 1 }, knownValues);

    if (!grounded) ungrounded.push({ text, sentence: sentenceAt(reply, match.index) });
  }

  rest = rest.replace(TIME, (time) => " ".repeat(time.length));

  for (const match of rest.matchAll(NUMBER)) {
    if (!isGrounded(readNumber(match), knownValues))
      ungrounded.push({ text: match[0].trim(), sentence: sentenceAt(reply, match.index) });
  }

  return ungrounded;
}
