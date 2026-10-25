import type { ModelMessage, ToolResultPart } from "ai";

const INTERRUPTED: ToolResultPart["output"] = {
  type: "error-text",
  value: "Langkah ini terputus dan tidak selesai.",
};

// A turn cut off mid-tool (timeout, restart) leaves a call without a result, and the provider
// then rejects every later turn of this one long thread (engine-plan A6). Every tool call gets a
// result right after its message; results whose call was trimmed away are dropped.
export function repairHistory(messages: ModelMessage[]): ModelMessage[] {
  const repaired: ModelMessage[] = [];
  let open = new Map<string, string>();

  const closeOpen = () => {
    if (open.size === 0) return;

    repaired.push({
      role: "tool",
      content: [...open].map(([toolCallId, toolName]) => ({
        type: "tool-result" as const,
        toolCallId,
        toolName,
        output: INTERRUPTED,
      })),
    });
    open = new Map();
  };

  for (const message of messages) {
    if (message.role === "tool") {
      const answered = message.content.filter(
        (part) => part.type !== "tool-result" || open.delete(part.toolCallId),
      );

      if (answered.length > 0) repaired.push({ ...message, content: answered });

      continue;
    }

    closeOpen();
    repaired.push(message);

    if (message.role === "assistant" && Array.isArray(message.content))
      for (const part of message.content)
        if (part.type === "tool-call") open.set(part.toolCallId, part.toolName);
  }

  closeOpen();

  return repaired;
}
