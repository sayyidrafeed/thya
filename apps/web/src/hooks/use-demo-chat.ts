import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useState } from "react";

import { env } from "@/lib/env";

export type ChatSide = "in" | "out";

export type ChatLine = { id: string; side: ChatSide; text: string };

const transport = new DefaultChatTransport({ api: `${env.apiUrl}/demo/chat` });

export const demoSuggestions = [
  "Omzet kemarin berapa?",
  "Menu apa yang paling laku minggu ini?",
  "Margin bulan lalu gimana?",
  "Hari apa yang paling ramai 2 minggu terakhir?",
  "Menu apa yang kurang laku bulan ini?",
] as const;

function toChatLine(message: UIMessage): ChatLine[] {
  const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");

  if (text === "") return [];

  return [{ id: message.id, side: message.role === "user" ? "out" : "in", text }];
}

export function useDemoChat() {
  const { messages, sendMessage, status, error } = useChat({ transport });
  const [draft, setDraft] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);

  const send = (text: string) => {
    const trimmed = text.trim();

    if (trimmed === "" || busy) return;

    setDraft("");
    void sendMessage({ text: trimmed });
  };

  return {
    lines: messages.flatMap(toChatLine),
    checkingData: busy && lastMessage?.role === "assistant" && toChatLine(lastMessage).length === 0,
    waiting: status === "submitted",
    busy,
    failed: error !== undefined,
    draft,
    setDraft,
    send,
  };
}
