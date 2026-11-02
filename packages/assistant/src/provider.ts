import { assistantModels } from "./models.ts";
import type { ChatMessage } from "./prompt.ts";

/** Why a provider call produced no usable result; never carries provider payloads or user text. */
export type AssistantProviderFailure = "unavailable" | "timeout" | "invalid_output";

export class AssistantProviderError extends Error {
  override readonly name = "AssistantProviderError";

  constructor(
    readonly reason: AssistantProviderFailure,
    message: string,
  ) {
    super(message);
  }
}

/** Pisto's port to a model provider: one structured extraction and one batch transcription. */
export interface AssistantProvider {
  readonly name: string;
  extract(input: {
    messages: readonly ChatMessage[];
    jsonSchema: Record<string, unknown>;
    signal: AbortSignal;
  }): Promise<unknown>;
  transcribe(input: { audio: Uint8Array; signal: AbortSignal }): Promise<string>;
}

/** The `env.AI` binding shape this adapter uses; wrangler supplies the implementation. */
export interface WorkersAiBinding {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}

type Runner = (
  model: string,
  inputs: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<unknown>;

function abortError(signal: AbortSignal): AssistantProviderError {
  return signal.reason instanceof DOMException && signal.reason.name === "TimeoutError"
    ? new AssistantProviderError("timeout", "The model provider did not answer in time")
    : new AssistantProviderError("unavailable", "The model provider call was cancelled");
}

/** Settles when the call does or the signal aborts, whichever happens first. */
function untilAborted<T>(call: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    call.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function guarded<T>(signal: AbortSignal, call: () => Promise<T>): Promise<T> {
  try {
    return await untilAborted(call(), signal);
  } catch (error) {
    if (error instanceof AssistantProviderError) throw error;
    if (signal.aborted) throw abortError(signal);
    // Provider messages can echo inputs, so only the error type survives.
    throw new AssistantProviderError(
      "unavailable",
      `The model provider failed (${error instanceof Error ? error.name : typeof error})`,
    );
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Workers AI returns `{ response }` for most models and chat-completion `choices` for others. */
function structuredOutput(result: unknown): unknown {
  if (!isRecord(result)) throw new AssistantProviderError("invalid_output", "No model output");
  let output: unknown = result.response;
  if (output === undefined && Array.isArray(result.choices)) {
    const [choice] = result.choices as unknown[];
    output = isRecord(choice) && isRecord(choice.message) ? choice.message.content : undefined;
  }
  if (typeof output === "string") {
    try {
      return JSON.parse(output);
    } catch {
      throw new AssistantProviderError("invalid_output", "The model output is not JSON");
    }
  }
  if (!isRecord(output)) throw new AssistantProviderError("invalid_output", "No model output");
  return output;
}

function workersAiProvider(name: string, run: Runner): AssistantProvider {
  return {
    name,
    async extract({ messages, jsonSchema, signal }) {
      const model = assistantModels["assistant.extract"];
      const responseFormat =
        model.responseFormat === "raw_schema"
          ? { type: "json_schema", json_schema: jsonSchema }
          : {
              type: "json_schema",
              json_schema: { name: "pisto_record", schema: jsonSchema, strict: true },
            };
      const result = await guarded(signal, () =>
        run(
          model.id,
          {
            ...model.inputs,
            messages,
            response_format: responseFormat,
            max_tokens: model.maxTokens,
          },
          signal,
        ),
      );
      return structuredOutput(result);
    },
    async transcribe({ audio, signal }) {
      const model = assistantModels["assistant.transcribe"];
      const result = await guarded(signal, () =>
        run(
          model.id,
          {
            audio: toBase64(audio),
            task: "transcribe",
            language: model.language,
            // Silence then yields no text instead of a hallucinated phrase.
            vad_filter: true,
          },
          signal,
        ),
      );
      if (!isRecord(result) || typeof result.text !== "string") {
        throw new AssistantProviderError("invalid_output", "The transcription has no text");
      }
      return result.text;
    },
  };
}

/** Production Worker: the `AI` binding declared in wrangler.jsonc. */
export function createWorkersAiBindingProvider(ai: WorkersAiBinding): AssistantProvider {
  return workersAiProvider("workers-ai-binding", (model, inputs, signal) =>
    ai.run(model, inputs, { signal }),
  );
}

/** Local Bun API: the Workers AI REST endpoint with an account-scoped API token. */
export function createWorkersAiRestProvider(input: {
  accountId: string;
  apiToken: string;
  fetch?: typeof fetch;
}): AssistantProvider {
  const send = input.fetch ?? fetch;
  return workersAiProvider("workers-ai-rest", async (model, inputs, signal) => {
    const response = await send(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(input.accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputs),
        signal,
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.success !== true) {
      const codes =
        isRecord(payload) && Array.isArray(payload.errors)
          ? payload.errors
              .map((entry) => (isRecord(entry) ? entry.code : undefined))
              .filter((code) => typeof code === "number")
          : [];
      throw new AssistantProviderError(
        "unavailable",
        `Workers AI answered ${response.status}${codes.length ? ` (${codes.join(", ")})` : ""}`,
      );
    }
    return payload.result;
  });
}
