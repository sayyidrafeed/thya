import type { UIMessage } from "ai";
import { z } from "zod";
import type { DraftPort } from "../actions/kinds";

const DEMO_SAVED =
  "Sudah dicatat, Kak. Ini versi demo, jadi data contoh Kopi Senja tidak berubah. Di WhatsApp, catatan Kakak benar-benar tersimpan.";

const DEMO_CANCELLED = "Oke Kak, dibatalkan. Tidak ada yang disimpan.";
const NOTHING_OPEN = "Belum ada yang menunggu konfirmasi, Kak.";

const toolPartSchema = z.object({
  type: z.string(),
  output: z.object({ status: z.string() }).loose().optional(),
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

  const decided = parts.findLastIndex(
    (part) => part.type === "tool-confirmDraft" || part.type === "tool-cancelDraft",
  );

  const open = lastDraft !== -1 && lastDraft > decided;

  return {
    create: async () => ({ draftId: crypto.randomUUID() }),
    confirmOpen: async () =>
      open ? { status: "done", message: DEMO_SAVED } : { status: "none", message: NOTHING_OPEN },
    cancelOpen: async () =>
      open
        ? { status: "done", message: DEMO_CANCELLED }
        : { status: "none", message: NOTHING_OPEN },
  };
}
