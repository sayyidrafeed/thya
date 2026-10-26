import type { LanguageModel } from "ai";
import { compactHistory } from "../agent";
import type { Db } from "../db/client";
import { loadSummary, messagesAfter, saveSummary } from "../modules/conversation";

// Engine-plan B1 / harness §6: past ~6k tokens of history (≈ 4 characters a token), the older turns
// fold into the summary; the last turns stay word for word. One cache miss per compaction.
export const COMPACTION_THRESHOLD_CHARS = 24_000;

// The tail kept verbatim, counted in owner messages (each opens a turn).
const KEPT_TURNS = 4;

export type CompactionDeps = { db: Db; model: LanguageModel };

export async function compactConversation(deps: CompactionDeps, businessId: string) {
  const stored = await loadSummary(deps.db, businessId);
  const rows = await messagesAfter(deps.db, businessId, stored?.coversThroughMessageId ?? 0);

  const turnStarts = rows.flatMap((row, index) => (row.message.role === "user" ? [index] : []));
  const tailStart = turnStarts.at(-KEPT_TURNS);

  // Too few turns to fold anything yet.
  if (tailStart === undefined || turnStarts.length <= KEPT_TURNS || tailStart === 0) return false;

  const older = rows.slice(0, tailStart);
  const last = older.at(-1);

  if (last === undefined) return false;

  const summary = await compactHistory({
    model: deps.model,
    previous: stored?.summary ?? null,
    messages: older.map((row) => row.message),
  });

  // A concurrent compaction that saved first wins; this one is dropped, not merged.
  return saveSummary(deps.db, {
    businessId,
    previousRevision: stored?.revision ?? 0,
    coversThroughMessageId: last.id,
    summary,
  });
}
