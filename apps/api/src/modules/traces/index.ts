import type { TurnResult } from "../../agent";
import type { Db } from "../../db/client";
import { agentSteps, agentTurns } from "../../db/schema";

export type TurnRecord = {
  traceId: string;
  businessId: string | null;
  channel: "whatsapp" | "demo" | "system";
  turn: TurnResult;
  durationMs: number;
  outboundMessages: number;
};

export async function recordFailedTurn(
  db: Db,
  {
    traceId,
    businessId,
    channel,
    durationMs,
    error,
  }: Omit<TurnRecord, "turn" | "outboundMessages"> & { error: string },
) {
  await db.insert(agentTurns).values({
    traceId,
    businessId,
    channel,
    action: "error",
    attempts: 0,
    ungrounded: [],
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    durationMs,
    error,
  });
}

// One write per turn (engine-plan B6), after the reply is decided.
export async function recordTurn(db: Db, record: TurnRecord) {
  const { traceId, businessId, channel, turn, durationMs, outboundMessages } = record;

  await db.transaction(async (tx) => {
    await tx.insert(agentTurns).values({
      traceId,
      businessId,
      channel,
      action: turn.check.action,
      attempts: turn.check.attempts,
      ungrounded: turn.check.ungrounded,
      inputTokens: turn.usage.inputTokens,
      cachedInputTokens: turn.usage.cachedInputTokens,
      outputTokens: turn.usage.outputTokens,
      durationMs,
      outboundMessages,
    });

    if (turn.toolCalls.length > 0)
      await tx.insert(agentSteps).values(
        turn.toolCalls.map((call, position) => ({
          traceId,
          position,
          toolName: call.toolName,
          input: call.input ?? null,
          output: call.output ?? null,
        })),
      );
  });
}
