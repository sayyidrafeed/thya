import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "./env";

// The only module that knows which LLM provider Thya uses. NetraRuntime runs on
// Indonesian infrastructure with zero data retention, so UMKM data stays in the country.
const netra = createOpenAICompatible({
  name: "netra",
  baseURL: env.NETRA_BASE_URL,
  apiKey: env.NETRA_API_KEY,
  includeUsage: true,
  // Netra documents tool requests as defaulting to high reasoning; pin it off so latency and cost
  // stay predictable. A caller that sets providerOptions.netra.thinking still wins.
  transformRequestBody: (body) => ({ thinking: { type: "disabled" }, ...body }),
});

export const chatModel = netra.chatModel(env.NETRA_MODEL);
