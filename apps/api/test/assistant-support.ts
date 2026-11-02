import type { AssistantConfig } from "../src/config.ts";
import type { AssistantServices } from "../src/routes/assistant.ts";

export const assistantTestConfig: AssistantConfig = {
  enabled: null,
  rest: null,
  interpretLimit: 20,
  transcribeLimit: 10,
  businessLimit: 60,
  audioLimitBytes: 1_600_000,
};

/** The composition with no model provider: every assistant call reports the assistant off. */
export function disabledAssistant(): AssistantServices {
  return {
    provider: null,
    records: {
      authorize: async () => {
        throw new Error("The disabled assistant never authorizes");
      },
      lookup: async () => {
        throw new Error("The disabled assistant never looks records up");
      },
    },
    suppliers: { lookup: async () => [] },
    consume: async () => ({ allowed: true, retryAfterSeconds: 60 }),
    limits: { interpretPerMinute: 20, transcribePerMinute: 10, businessPerMinute: 60 },
    timeouts: { extractMs: 1_000, transcribeMs: 1_000 },
  };
}
