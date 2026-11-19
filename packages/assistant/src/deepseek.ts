import { z } from "zod";
import type { ChatMessage } from "./prompt.ts";
import { type AssistantProvider, AssistantProviderError } from "./provider.ts";

/** The DeepSeek model every Pisto task uses; a change reruns the evaluation sets. */
export const deepSeekModelId = "deepseek-flash";
const endpoint = "https://api.deepseek.com/chat/completions";

const completionSchema = z.object({
  choices: z.tuple([
    z.object({
      finish_reason: z.literal("stop"),
      message: z.object({ content: z.string().trim().min(1).max(16_384) }),
    }),
  ]),
});

/**
 * One JSON-mode completion, returned as the object the model wrote. A redirect is never followed,
 * so the credential cannot be replayed to another host.
 */
export async function deepSeekJson(input: {
  apiKey: string;
  send: typeof fetch;
  messages: readonly ChatMessage[];
  maxTokens: number;
  signal: AbortSignal;
}): Promise<unknown> {
  try {
    const response = await input.send(endpoint, {
      method: "POST",
      redirect: "manual",
      signal: input.signal,
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: deepSeekModelId,
        thinking: { type: "disabled" },
        stream: false,
        max_tokens: input.maxTokens,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: input.messages,
      }),
    });
    if (!response.ok) {
      throw new AssistantProviderError("unavailable", `DeepSeek returned HTTP ${response.status}`);
    }
    const result = completionSchema.parse(await response.json());
    return JSON.parse(result.choices[0].message.content);
  } catch (error) {
    if (error instanceof AssistantProviderError) throw error;
    if (input.signal.aborted) {
      throw new AssistantProviderError("timeout", "The DeepSeek call ended");
    }
    throw new AssistantProviderError(
      error instanceof TypeError ? "unavailable" : "invalid_output",
      "DeepSeek returned no usable result",
    );
  }
}

/**
 * A provider whose extraction runs on DeepSeek. JSON mode does not enforce a schema, so the schema
 * travels in the prompt and the caller validates the object like any model output. DeepSeek has no
 * speech model: transcription stays with `transcriber`, or is unavailable without one.
 */
export function createDeepSeekProvider(
  apiKey: string,
  transcriber: AssistantProvider | null,
  send: typeof fetch = fetch,
): AssistantProvider {
  return {
    name: transcriber ? `deepseek+${transcriber.name}` : "deepseek",
    transcribes: transcriber?.transcribes ?? false,
    extract({ messages, jsonSchema, signal }) {
      const [instructions, ...turns] = messages;
      if (!instructions) {
        throw new AssistantProviderError("invalid_output", "The extraction prompt is empty");
      }
      return deepSeekJson({
        apiKey,
        send,
        signal,
        maxTokens: 1_024,
        messages: [
          instructions,
          {
            role: "system",
            content: `Answer with one JSON object that validates against this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
          },
          ...turns,
        ],
      });
    },
    async transcribe(input) {
      if (!transcriber) {
        throw new AssistantProviderError("unavailable", "No transcription provider is configured");
      }
      return transcriber.transcribe(input);
    },
  };
}
