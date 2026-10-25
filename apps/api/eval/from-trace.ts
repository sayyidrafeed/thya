// U7: one step from a production trace to an eval case. Prints an EvalCase skeleton (owner
// messages, the tools that ran, the turn's time) to complete by hand in eval/cases/.
// `bun --env-file=../../.env eval/from-trace.ts <traceId>`. Anonymised per Q10 before it is
// pasted anywhere Claude reads: emails, phone numbers and the business name are replaced and
// amounts are scaled; person names in free text still need a manual pass.
import type { ModelMessage } from "ai";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { agentSteps, agentTurns, businesses, messages } from "../src/db/schema";
import { EVAL_NOW } from "./cases";

const SCALE = 0.9;

const isYear = (digits: string) => /^(19|20)\d{2}$/.test(digits);

const withDots = (value: number) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function scaleAmount(digits: string): string {
  const value = Number(digits.replaceAll(".", ""));
  const scaled = Math.max(500, Math.round((value * SCALE) / 500) * 500);

  return digits.includes(".") ? withDots(scaled) : String(scaled);
}

export function anonymize(text: string, businessName: string | null): string {
  const named = businessName ? text.replaceAll(businessName, "Kopi Senja") : text;

  return named
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "pemilik@contoh.id")
    .replace(/(\+?62|0)8\d{7,12}/g, "081234567890")
    .replace(
      /(\d{1,3}(?:\.\d{3})+|\d{4,})|(\d+(?:[.,]\d+)?)\s?(rb|ribu|k|jt|juta)\b/gi,
      (match, amount: string | undefined, short: string | undefined, unit: string | undefined) => {
        // Years and long digit runs (phone numbers, ids) are not amounts.
        if (amount !== undefined)
          return isYear(amount) || /^\d{9,}$/.test(amount) ? match : scaleAmount(amount);

        const scaled = Math.max(1, Math.round(Number(short!.replace(",", ".")) * SCALE));

        return `${scaled} ${unit}`;
      },
    );
}

const amount = z.number().min(1000);

const toolInput = z.record(z.string(), z.json());

const anonymizeArgs = (input: z.infer<typeof toolInput>) =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      const parsed = amount.safeParse(value);

      return [key, parsed.success ? Math.round((parsed.data * SCALE) / 500) * 500 : value];
    }),
  );

const textOf = ({ content }: ModelMessage) =>
  Array.isArray(content)
    ? content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")
    : content;

if (import.meta.main) {
  const traceId = process.argv[2];

  if (traceId === undefined || !/^[0-9a-f-]{36}$/i.test(traceId)) {
    console.error("usage: bun --env-file=../../.env eval/from-trace.ts <traceId>");
    process.exit(2);
  }

  // Loaded here so tests can import anonymize() without database credentials.
  const { createDb } = await import("../src/db/client");
  const { env } = await import("../src/env");
  const db = createDb(env.DATABASE_URL);

  const [turn] = await db
    .select({
      createdAt: agentTurns.createdAt,
      action: agentTurns.action,
      ungrounded: agentTurns.ungrounded,
      error: agentTurns.error,
      businessName: businesses.name,
    })
    .from(agentTurns)
    .leftJoin(businesses, eq(businesses.id, agentTurns.businessId))
    .where(eq(agentTurns.traceId, traceId));

  if (turn === undefined) {
    console.error(`no agent_turns row for ${traceId}`);
    await db.$client.end();
    process.exit(1);
  }

  const rows = await db
    .select({ message: messages.message })
    .from(messages)
    .where(eq(messages.traceId, traceId))
    .orderBy(asc(messages.id));

  const steps = await db
    .select({ toolName: agentSteps.toolName, input: agentSteps.input })
    .from(agentSteps)
    .where(eq(agentSteps.traceId, traceId))
    .orderBy(asc(agentSteps.position));

  const clean = (text: string) => anonymize(text, turn.businessName);
  const userTurns = rows.filter((row) => row.message.role === "user");
  const reply = rows.findLast((row) => row.message.role === "assistant");

  const skeleton = {
    id: `trace-${traceId.slice(0, 8)}`,
    refs: [`trace:${traceId}`],
    suite: "capability",
    category: "TODO",
    turns: userTurns.map((row) => clean(textOf(row.message))),
    expect: {
      tools: steps.map((step) => ({
        name: step.toolName,
        args: anonymizeArgs(toolInput.parse(step.input)),
      })),
      mustMatch: [],
      mustNotMatch: [],
    },
  };

  console.log(
    [
      `// From trace ${traceId}, ${turn.createdAt.toISOString()} (EVAL_NOW is ${EVAL_NOW.toISOString()}; adjust dates in args if the case depends on "today").`,
      `// Production: action=${turn.action}${turn.error ? `, error=${turn.error}` : ""}, ungrounded=${JSON.stringify(turn.ungrounded)}`,
      `// Reply sent: ${reply ? clean(textOf(reply.message)).replaceAll("\n", " ").slice(0, 300) : "(none)"}`,
      "// TODO: keep only the tools and args the right answer needs, write mustMatch/mustNotMatch",
      "// from the failure, check person names by hand (Q10), then add it to eval/cases/.",
      `${JSON.stringify(skeleton, null, 2)},`,
    ].join("\n"),
  );

  await db.$client.end();
}
