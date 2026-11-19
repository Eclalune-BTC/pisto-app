import {
  type AssistantProvider,
  AssistantProviderError,
  answerBusinessQuestion,
  type BusinessModel,
  businessPromptVersion,
  type CatalogModel,
  type ConversationFacts,
  catalogModelId,
  catalogPromptVersion,
  catalogReply,
  deepSeekModelId,
  extractionPromptVersion,
  interpretSentence,
  readBusinessEvidence,
  type SupplierDirectory,
} from "@pisto/assistant";
import {
  assistantInterpretRequestSchema,
  assistantScopeHeader,
  assistantTranscriptionResponseSchema,
  type BusinessPermission,
  businessAnswerQuerySchema,
  businessReadPermissions,
  businessTopicPermissions,
  businessTurnRequestSchema,
  businessTurnResponseSchema,
  catalogTurnRequestSchema,
} from "@pisto/contracts";
import type {
  AssistantDirectoryRepository,
  CatalogRepository,
  ConsumeRateLimit,
  ProductActor,
} from "@pisto/db";

import { ApiError } from "../errors.ts";
import { contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

export const transcriptionPath = "/v1/assistant/transcriptions";
/** The client encodes 16 kHz mono PCM WAV, the one container verified with the transcription model. */
export const transcriptionMediaTypes = ["audio/wav"] as const;

export interface AssistantServices {
  /** Null when the kill switch is off or no provider is configured. */
  provider: AssistantProvider | null;
  catalogModel: CatalogModel | null;
  businessModel: BusinessModel | null;
  records: AssistantDirectoryRepository;
  suppliers: SupplierDirectory<ProductActor>;
  consume: ConsumeRateLimit;
  limits: { interpretPerMinute: number; transcribePerMinute: number; businessPerMinute: number };
  timeouts: { extractMs: number; transcribeMs: number };
}

type Task = "interpret" | "transcribe";

function log(event: {
  task: Task | "catalog" | "business";
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
      promptVersion:
        event.task === "interpret"
          ? extractionPromptVersion
          : event.task === "business"
            ? businessPromptVersion
            : event.task === "catalog"
              ? catalogPromptVersion
              : undefined,
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

export function assistantRoutes(input: {
  access: ProductAccess;
  assistant: AssistantServices;
  catalog: Pick<CatalogRepository, "getProduct">;
  facts: ConversationFacts<ProductActor>;
}) {
  const { assistant } = input;
  const routes = protectedRoutes(input.access);

  /** Authorizes the active business, then charges the per-user and per-business budgets. */
  async function admit(
    actor: ProductActor,
    task: Task,
    set: { headers: Record<string, unknown> },
    expectedBusinessId?: string,
    permissions: readonly BusinessPermission[] = [],
  ) {
    const scope = await assistant.records.authorize(actor, permissions);
    const { businessId } = scope;
    if (expectedBusinessId !== undefined && businessId !== expectedBusinessId) {
      throw new ApiError(403, "FORBIDDEN", "The active business changed");
    }
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
    return scope;
  }

  async function call<T>(
    task: Task | "catalog" | "business",
    provider: string,
    requestId: string | undefined,
    run: () => Promise<T>,
  ) {
    const startedAt = performance.now();
    const durationMs = () => Math.round(performance.now() - startedAt);
    try {
      const result = await run();
      log({ task, provider, outcome: "ok", durationMs: durationMs(), requestId });
      return result;
    } catch (error) {
      if (!(error instanceof AssistantProviderError)) throw error;
      log({
        task,
        provider,
        outcome: `provider_${error.reason}`,
        durationMs: durationMs(),
        requestId,
      });
      throw unavailable();
    }
  }

  routes.get("/assistant/status", ({ request }) => {
    const enabled = assistant.provider !== null;
    const include = new URL(request.url).searchParams.getAll("include");
    return {
      data: {
        enabled,
        transcription: assistant.provider?.transcribes ?? false,
        ...(include.includes("catalog") && {
          catalogConversation: assistant.catalogModel !== null,
        }),
        ...(include.includes("business") && {
          businessConversation: assistant.businessModel !== null,
        }),
      },
    };
  });

  routes.post(
    "/assistant/business-turns",
    async (context) => {
      const { actor, body, request, set } = context;
      const model = assistant.businessModel;
      if (!model) throw unavailable();
      const { localDate } = await admit(actor, "interpret", set, body.expectedBusinessId);
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(assistant.timeouts.extractMs),
      ]);
      const question = { text: body.text, previousQuestions: body.previousQuestions };
      const plan = await call("business", deepSeekModelId, requestIdOf(context), () =>
        model.plan(question, localDate, signal),
      );
      if (plan.kind !== "read") return { data: { reply: plan } };
      const permissions = [
        ...new Set(plan.reads.flatMap((read) => businessReadPermissions(read.source))),
      ];
      async function reauthorize() {
        const scope = await assistant.records.authorize(actor, permissions);
        if (scope.businessId !== body.expectedBusinessId)
          throw new ApiError(403, "FORBIDDEN", "The active business changed");
        if (signal.aborted) throw unavailable();
      }
      await reauthorize();
      const evidence = await Promise.all(
        plan.reads.map((read) => readBusinessEvidence(input.facts, actor, read, localDate)),
      );
      await admit(actor, "interpret", set, body.expectedBusinessId, permissions);
      if (signal.aborted) throw unavailable();
      const wording = await call("business", deepSeekModelId, requestIdOf(context), () =>
        model.compose(question, evidence, signal),
      );
      await reauthorize();
      const reply =
        typeof wording === "string"
          ? {
              kind: "answer",
              text: wording,
              asOf: localDate,
              sources: [...new Set(plan.reads.map((read) => read.source))],
            }
          : wording;
      return businessTurnResponseSchema.parse({ data: { reply } });
    },
    {
      parse: "json",
      body: contract(businessTurnRequestSchema, "The business question is invalid"),
    },
  );

  // Answers are exact reads with no model call, so they stay available with the assistant off and
  // spend the product read budget, not the model budgets.
  routes.get(
    "/assistant/answers",
    async ({ actor, query }) => {
      const scope = await assistant.records.authorize(actor, [
        businessTopicPermissions[query.topic],
      ]);
      if (scope.businessId !== query.expectedBusinessId) {
        throw new ApiError(403, "FORBIDDEN", "The active business changed");
      }
      const answer = await answerBusinessQuestion(input.facts, actor, query, scope.localDate);
      return { data: { answer } };
    },
    { ...queryContract(businessAnswerQuerySchema, "The business question is invalid") },
  );

  routes.post(
    "/assistant/catalog-turns",
    async (context) => {
      const { actor, body, set, request } = context;
      const model = assistant.catalogModel;
      if (!model) throw unavailable();
      await admit(actor, "interpret", set, body.expectedBusinessId, ["catalog:read"]);
      const read = async () => {
        const detail = await input.catalog.getProduct(actor, body.productId);
        if (detail.businessId !== body.expectedBusinessId)
          throw new ApiError(403, "FORBIDDEN", "The active business changed");
        if (detail.product.status !== "active")
          throw new ApiError(404, "NOT_FOUND", "Product was not found");
        return detail;
      };
      const selected = await read();
      const intent = await call("catalog", catalogModelId, requestIdOf(context), () =>
        model({
          text: body.text,
          productName: selected.product.name,
          hasQuote: body.previousQuantity !== null,
          signal: AbortSignal.any([
            request.signal,
            AbortSignal.timeout(assistant.timeouts.extractMs),
          ]),
        }),
      );
      const scope = await assistant.records.authorize(
        actor,
        intent.intent === "prepare_sale" ? ["catalog:read", "sales:create"] : ["catalog:read"],
      );
      if (scope.businessId !== body.expectedBusinessId)
        throw new ApiError(403, "FORBIDDEN", "The active business changed");
      const detail = await read();
      return { data: { ...detail, reply: catalogReply(body, detail.product, intent) } };
    },
    { parse: "json", body: contract(catalogTurnRequestSchema, "The catalog follow-up is invalid") },
  );

  routes.post(
    "/assistant/interpretations",
    async (context) => {
      const { actor, body, set } = context;
      const provider = assistant.provider;
      if (!provider) throw unavailable();
      await admit(actor, "interpret", set, body.expectedBusinessId);
      const interpretation = await call("interpret", provider.name, requestIdOf(context), () =>
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
      const provider = assistant.provider;
      if (!provider?.transcribes) throw unavailable();
      await admit(actor, "transcribe", set, request.headers.get(assistantScopeHeader) ?? undefined);
      const audio = new Uint8Array(await request.arrayBuffer());
      if (!isWave(audio)) {
        throw new ApiError(415, "BAD_REQUEST", "This audio format is not accepted");
      }
      const text = await call("transcribe", provider.name, requestIdOf(context), () =>
        provider.transcribe({
          audio,
          signal: AbortSignal.timeout(assistant.timeouts.transcribeMs),
        }),
      );
      const result = assistantTranscriptionResponseSchema.safeParse({
        data: { text: text.replace(/\s+/g, " ").trim() },
      });
      if (!result.success)
        throw new ApiError(413, "BAD_REQUEST", "The transcription exceeds the supported length");
      return result.data;
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
