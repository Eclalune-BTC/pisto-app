export { blankExtraction } from "./extraction.ts";

import type { ChatMessage } from "./prompt.ts";
import { type AssistantProvider, AssistantProviderError } from "./provider.ts";

/**
 * Deterministic provider for tests. `extract` answers from the scripted outputs (an `Error`
 * rejects like a provider outage) and records every call so tests can inspect the prompt.
 */
export function createFakeAssistantProvider(script: {
  extract?: (sentence: string) => unknown;
  transcribe?: (audio: Uint8Array) => string | Error;
}) {
  const calls: { extract: ChatMessage[][]; transcribe: Uint8Array[] } = {
    extract: [],
    transcribe: [],
  };
  const provider: AssistantProvider = {
    name: "fake",
    async extract({ messages }) {
      calls.extract.push([...messages]);
      const sentence = messages.at(-1)?.content ?? "";
      const output = script.extract?.(sentence);
      if (output === undefined || output instanceof Error) {
        throw new AssistantProviderError("unavailable", "The fake provider is down");
      }
      return output;
    },
    async transcribe({ audio }) {
      calls.transcribe.push(audio);
      const output = script.transcribe?.(audio);
      if (output === undefined || output instanceof Error) {
        throw new AssistantProviderError("unavailable", "The fake provider is down");
      }
      return output;
    },
  };
  return { provider, calls };
}
