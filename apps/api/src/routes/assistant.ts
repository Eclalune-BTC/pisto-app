import {
  type AssistantProvider,
  AssistantProviderError,
  extractionPromptVersion,
  interpretSentence,
  type SupplierDirectory,
} from "@pisto/assistant";
import { assistantInterpretRequestSchema } from "@pisto/contracts";
import type { AssistantDirectoryRepository, ConsumeRateLimit, ProductActor } from "@pisto/db";

import { ApiError } from "../errors.ts";
import { contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

export const transcriptionPath = "/v1/assistant/transcriptions";
/** The client encodes 16 kHz mono PCM WAV, the one container verified with the transcription model. */
export const transcriptionMediaTypes = ["audio/wav"] as const;

export interface AssistantServices {
  /** Null when the kill switch is off or no provider is configured. */
  provider: AssistantProvider | null;
  records: AssistantDirectoryRepository;
  suppliers: SupplierDirectory<ProductActor>;
  consume: ConsumeRateLimit;
  limits: { interpretPerMinute: number; transcribePerMinute: number; businessPerMinute: number };
  timeouts: { extractMs: number; transcribeMs: number };
}

type Task = "interpret" | "transcribe";

function log(event: {
  task: Task;
  provider: string;
  outcome: string;
  durationMs: number;
  requestId: string | undefined;
}) {
  // Never the sentence, the audio, the transcript or the model output.
  console.info(
    JSON.stringify({
      level: "info",
      message: "Assistant call",
      promptVersion: event.task === "interpret" ? extractionPromptVersion : undefined,
      ...event,
    }),
  );
}

const unavailable = () =>
  new ApiError(
    503,
    "SERVICE_UNAVAILABLE",
    "The assistant could not answer; try again or use the form",
  );

/** RIFF....WAVE: the only container the transcription route accepts. */
function isWave(audio: Uint8Array): boolean {
  const tag = (offset: number) => String.fromCharCode(...audio.subarray(offset, offset + 4));
  return audio.byteLength > 44 && tag(0) === "RIFF" && tag(8) === "WAVE";
}

export function assistantRoutes(input: { access: ProductAccess; assistant: AssistantServices }) {
  const { assistant } = input;
  const routes = protectedRoutes(input.access);

  /** Authorizes the active business, then charges the per-user and per-business budgets. */
  async function admit(actor: ProductActor, task: Task, set: { headers: Record<string, unknown> }) {
    const provider = assistant.provider;
    if (!provider) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "The assistant is turned off");
    }
    const { businessId } = await assistant.records.authorize(actor);
    const budgets = [
      {
        key: `pisto:assistant:${task}:${businessId}:${actor.userId}`,
        limit:
          task === "interpret"
            ? assistant.limits.interpretPerMinute
            : assistant.limits.transcribePerMinute,
      },
      { key: `pisto:assistant:business:${businessId}`, limit: assistant.limits.businessPerMinute },
    ];
    for (const budget of budgets) {
      const result = await assistant.consume(budget);
      if (!result.allowed) {
        set.headers["Retry-After"] = String(result.retryAfterSeconds);
        throw new ApiError(429, "RATE_LIMITED", "Too many assistant requests; try again shortly");
      }
    }
    return provider;
  }

  async function call<T>(
    task: Task,
    provider: AssistantProvider,
    requestId: string | undefined,
    run: () => Promise<T>,
  ) {
    const startedAt = performance.now();
    const durationMs = () => Math.round(performance.now() - startedAt);
    try {
      const result = await run();
      log({ task, provider: provider.name, outcome: "ok", durationMs: durationMs(), requestId });
      return result;
    } catch (error) {
      if (!(error instanceof AssistantProviderError)) throw error;
      log({
        task,
        provider: provider.name,
        outcome: `provider_${error.reason}`,
        durationMs: durationMs(),
        requestId,
      });
      throw unavailable();
    }
  }

  routes.get("/assistant/status", () => {
    const enabled = assistant.provider !== null;
    return { data: { enabled, transcription: enabled } };
  });

  routes.post(
    "/assistant/interpretations",
    async (context) => {
      const { actor, body, set } = context;
      const provider = await admit(actor, "interpret", set);
      const interpretation = await call("interpret", provider, requestIdOf(context), () =>
        interpretSentence(
          {
            provider,
            records: assistant.records,
            suppliers: assistant.suppliers,
            timeoutMs: assistant.timeouts.extractMs,
          },
          actor,
          body,
        ),
      );
      return { data: { interpretation } };
    },
    {
      parse: "json",
      body: contract(assistantInterpretRequestSchema, "The sentence to interpret is invalid"),
    },
  );

  routes.post(
    "/assistant/transcriptions",
    async (context) => {
      const { actor, request, set } = context;
      const provider = await admit(actor, "transcribe", set);
      const audio = new Uint8Array(await request.arrayBuffer());
      if (!isWave(audio)) {
        throw new ApiError(415, "BAD_REQUEST", "This audio format is not accepted");
      }
      const text = await call("transcribe", provider, requestIdOf(context), () =>
        provider.transcribe({
          audio,
          signal: AbortSignal.timeout(assistant.timeouts.transcribeMs),
        }),
      );
      return { data: { text: text.replace(/\s+/g, " ").trim().slice(0, 2_000) } };
    },
    // The raw body was already bounded by the request-body limit for this path.
    { parse: "none" },
  );

  return routes;
}

/** `requestContext` decorates every request at the application root. */
function requestIdOf(context: object): string | undefined {
  const value = (context as { requestId?: unknown }).requestId;
  return typeof value === "string" ? value : undefined;
}
