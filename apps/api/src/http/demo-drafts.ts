import type { UIMessage } from "ai";
import { z } from "zod";
import { decideConfirm, draftCheck, NOTHING_OPEN, type LatestDraft } from "../actions";
import { draftDecisionSchema, draftedSchema, type TurnDraft } from "../agent";
import type { DraftOutcome, DraftPort } from "../actions/kinds";

const DEMO_SAVED: DraftOutcome = {
  status: "done",
  message:
    "Siap, Kak. Ini versi demo, jadi data contoh Kopi Senja tidak berubah dan tidak ada yang dikirim. Di WhatsApp, ini benar-benar tersimpan.",
};

const DEMO_SAVED_BEFORE =
  "Yang tadi sudah dikonfirmasi, Kak. Belum ada yang baru untuk dikonfirmasi.";

const DEMO_CANCELLED: DraftOutcome = {
  status: "done",
  message: "Oke Kak, dibatalkan. Tidak ada yang disimpan.",
};

// Only drafts and the decisions on them matter, read with the schemas of the tools that wrote them.
const toolPartSchema = z.object({
  type: z.string(),
  output: z.union([
    draftedSchema.pick({ status: true, summary: true }),
    draftDecisionSchema.pick({ status: true, outcome: true }),
  ]),
});

type ToolPart = z.infer<typeof toolPartSchema>;

// A confirm or cancel with one of these outcomes decided its draft; the others left it as it was.
const SETTLING_OUTCOMES: readonly DraftOutcome["status"][] = ["done", "failed"];

function settledAs(decision: ToolPart | undefined): LatestDraft["status"] {
  if (decision === undefined) return "pending";

  if (decision.type === "tool-cancelDraft") return "cancelled";

  return decision.output.status === "ok" && decision.output.outcome === "failed"
    ? "failed"
    : "done";
}

// As in Postgres: only a confirm or cancel that decided the latest draft settles it.
function latestIn(parts: ToolPart[]): LatestDraft | null {
  const at = parts.findLastIndex((part) => part.output.status === "draft");
  const draft = parts[at]?.output;

  if (draft?.status !== "draft") return null;

  const decision = parts
    .slice(at + 1)
    .find(
      ({ type, output }) =>
        (type === "tool-confirmDraft" || type === "tool-cancelDraft") &&
        output.status === "ok" &&
        SETTLING_OUTCOMES.includes(output.outcome),
    );

  return { status: settledAs(decision), summary: draft.summary, madeThisTurn: false };
}

// The web demo stores nothing and every visitor shares one demo shop, so its drafts live in the
// visitor's own history, plus the one this request makes.
export function demoDraftPort(messages: UIMessage[]): DraftPort {
  let latest = latestIn(
    messages.flatMap((message) =>
      message.parts.flatMap((part) => {
        const parsed = toolPartSchema.safeParse(part);

        return parsed.success ? [parsed.data] : [];
      }),
    ),
  );

  let made: TurnDraft | null = null;
  let tookOver: string | null = null;

  return {
    create: async ({ summary }) => {
      const draftId = crypto.randomUUID();

      tookOver = latest?.status === "pending" && !latest.madeThisTurn ? latest.summary : tookOver;
      latest = { status: "pending", summary, madeThisTurn: true };
      made = { draftId, summary };

      return { draftId, replaced: tookOver };
    },
    endTurn: async () => (latest?.status === "pending" && latest.madeThisTurn ? made : null),
    listSchedules: async () => [],
    // The same rule as dbDraftPort, with demo wording: nothing here is really stored.
    confirmOpen: async () => {
      const decision = decideConfirm(latest);

      if ("run" in decision) {
        latest = { ...decision.run, status: "done" };

        return DEMO_SAVED;
      }

      return decision.status === "already_done"
        ? { status: "already_done", message: DEMO_SAVED_BEFORE }
        : decision;
    },
    cancelOpen: async () => {
      if (latest?.status !== "pending") return NOTHING_OPEN;

      latest = { ...latest, status: "cancelled" };

      return DEMO_CANCELLED;
    },
    checkLatest: async () => {
      const check = draftCheck(latest);

      return check.status === "already_done" ? { ...check, message: DEMO_SAVED_BEFORE } : check;
    },
  };
}
