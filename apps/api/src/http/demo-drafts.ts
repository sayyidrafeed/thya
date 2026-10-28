import type { UIMessage } from "ai";
import { z } from "zod";
import type { DraftPort } from "../actions/kinds";

const DEMO_SAVED =
  "Siap, Kak. Ini versi demo, jadi data contoh Kopi Senja tidak berubah dan tidak ada yang dikirim. Di WhatsApp, ini benar-benar tersimpan.";

const DEMO_SAVED_BEFORE =
  "Yang tadi sudah dikonfirmasi, Kak. Belum ada yang baru untuk dikonfirmasi.";

const DEMO_CANCELLED = "Oke Kak, dibatalkan. Tidak ada yang disimpan.";
const NOTHING_OPEN = "Belum ada yang menunggu konfirmasi, Kak.";

const toolPartSchema = z.object({
  type: z.string(),
  output: z.object({ status: z.string(), outcome: z.string().optional() }).loose().optional(),
});

// The web demo stores nothing and every visitor shares one demo shop, so its drafts live in the
// visitor's own history: the latest draft not yet followed by a confirm or cancel is "open".
export function demoDraftPort(messages: UIMessage[]): DraftPort {
  const parts = messages.flatMap((message) =>
    message.parts.flatMap((part) => {
      const parsed = toolPartSchema.safeParse(part);

      return parsed.success ? [parsed.data] : [];
    }),
  );

  const lastDraft = parts.findLastIndex((part) => part.output?.status === "draft");

  // The first confirm or cancel after the latest draft settled it, as its status does in Postgres.
  const decision =
    lastDraft === -1
      ? undefined
      : parts
          .slice(lastDraft + 1)
          .find((part) => part.type === "tool-confirmDraft" || part.type === "tool-cancelDraft");

  const open = lastDraft !== -1 && decision === undefined;
  const saved = decision?.type === "tool-confirmDraft" && decision.output?.outcome === "done";

  return {
    create: async () => ({ draftId: crypto.randomUUID() }),
    listSchedules: async () => [],
    // As dbDraftPort: a "ya" after the latest draft was saved hears so, and nothing runs twice.
    confirmOpen: async () => {
      if (open) return { status: "done", message: DEMO_SAVED };

      return saved
        ? { status: "already_done", message: DEMO_SAVED_BEFORE }
        : { status: "none", message: NOTHING_OPEN };
    },
    cancelOpen: async () =>
      open
        ? { status: "done", message: DEMO_CANCELLED }
        : { status: "none", message: NOTHING_OPEN },
  };
}
