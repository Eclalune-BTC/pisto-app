import { describe, expect, spyOn, test } from "bun:test";
import { blankExtraction, type Extraction } from "@pisto/assistant";
import { createFakeAssistantProvider } from "@pisto/assistant/testing";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import { assistantInterpretResponseSchema } from "@pisto/contracts";
import {
  type AssistantDirectoryRepository,
  type DatabaseHandle,
  type ProductActor,
  ProductError,
} from "@pisto/db";

import { createApp } from "../src/app.ts";
import { ApiConfigurationError, parseApiConfig } from "../src/config.ts";
import { RealtimeHub } from "../src/realtime.ts";
import type { AssistantServices } from "../src/routes/assistant.ts";
import { assistantProvider } from "../src/runtime.ts";
import { assistantTestConfig } from "./assistant-support.ts";
import { testClient } from "./http-client.ts";

const origin = "https://app.example.test";
const audioLimitBytes = 8_192;
const jsonLimitBytes = 2_048;

function unavailable<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: () => async () => {
      throw new Error(`${name} is not configured in this test`);
    },
  });
}

/** A 16-bit mono PCM WAV header followed by `samples` silent samples. */
function wave(samples: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(44 + samples * 2));
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples * 2, true);
  return bytes;
}

const saleExtraction: Extraction = {
  ...blankExtraction,
  kind: "sale",
  fragments: [{ text: "vendí", field: "kind" }],
  items: [{ name: "café", quantity: "2", unitPrice: null }],
  settlement: "paid",
  paymentMethod: "cash",
};

function setup(
  options: {
    authenticated?: boolean;
    enabled?: boolean;
    extract?: (sentence: string) => unknown;
    transcribe?: (audio: Uint8Array) => string | Error;
    authorize?: AssistantDirectoryRepository["authorize"];
    allowed?: (key: string) => boolean;
  } = {},
) {
  const fake = createFakeAssistantProvider({
    extract: options.extract ?? (() => saleExtraction),
    transcribe: options.transcribe ?? (() => "  Vendí dos cafés  "),
  });
  const consumed: string[] = [];
  const lookups: Array<{ actor: ProductActor; terms: unknown }> = [];
  const records: AssistantDirectoryRepository = {
    authorize: options.authorize ?? (async () => ({ businessId: "business_test" })),
    async lookup(actor, terms) {
      lookups.push({ actor, terms });
      return {
        context: {
          businessId: "business_test",
          currency: "USD",
          currencyMinorUnitDigits: 2,
          timeZone: "America/El_Salvador",
          localDate: "2026-11-02",
          localTime: "09:30",
          permissions: ["sales:create", "assistant:use"],
        },
        products: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Café molido 1 lb",
            sellingPriceMinorUnits: "325",
            quantityPrecision: 0,
            tracked: false,
            onHandMinorUnits: null,
          },
        ],
        customers: [],
        accounts: [{ id: "00000000-0000-4000-8000-000000000031", name: "Caja", kind: "cash" }],
      };
    },
  };
  const assistant: AssistantServices = {
    provider: options.enabled === false ? null : fake.provider,
    records,
    suppliers: { lookup: async () => [] },
    consume: async ({ key }) => {
      consumed.push(key);
      return { allowed: options.allowed?.(key) ?? true, retryAfterSeconds: 42 };
    },
    limits: { interpretPerMinute: 20, transcribePerMinute: 10, businessPerMinute: 60 },
    timeouts: { extractMs: 1_000, transcribeMs: 1_000 },
  };
  const auth = {
    handler: async () => new Response(null, { status: 404 }),
    api: {
      getSession: async () =>
        options.authenticated === false
          ? null
          : {
              user: { id: "user_test" },
              session: {
                id: "session_test",
                expiresAt: new Date(Date.now() + 60_000),
                activeOrganizationId: "business_test",
              },
            },
    },
  } as unknown as Auth;
  const app = createApp({
    config: {
      host: "127.0.0.1",
      port: 3001,
      corsOrigins: [origin],
      requestBodyLimitBytes: jsonLimitBytes,
      production: false,
      productWritesEnabled: true,
      productReadLimit: 300,
      productWriteLimit: 60,
      assistant: { ...assistantTestConfig, audioLimitBytes },
    },
    authBaseUrl: "https://api.example.test",
    auth,
    billing: {
      checkoutEnabled: false,
      revenueCatEnabled: false,
      catalog: [],
    } as unknown as BillingRuntime,
    database: {
      db: {},
      client: {},
      ping: async () => undefined,
      close: async () => undefined,
    } as unknown as DatabaseHandle,
    repositories: {
      businesses: unavailable("Business repository"),
      cash: unavailable("Cash repository"),
      catalog: unavailable("Catalog repository"),
      members: unavailable("Business members repository"),
      debtors: unavailable("Debtors repository"),
      moneyTrend: unavailable("Money trend repository"),
      movements: unavailable("Movements repository"),
      purchases: unavailable("Purchases repository"),
      receivables: unavailable("Receivables repository"),
      reports: unavailable("Reports repository"),
      sales: unavailable("Sales repository"),
    },
    consumeProductRequest: async () => ({ allowed: true, retryAfterSeconds: 60 }),
    realtime: new RealtimeHub(),
    assistant,
  });
  return { client: testClient(app), calls: fake.calls, consumed, lookups };
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify(body),
});

const audio = (body: BodyInit, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "audio/wav", origin, ...headers },
  body,
});

describe("assistant status and kill switch", () => {
  test("reports the assistant off without a provider and refuses its commands", async () => {
    const { client, calls } = setup({ enabled: false });
    const status = await client.request("/v1/assistant/status");
    expect(await status.json()).toEqual({ data: { enabled: false, transcription: false } });

    const interpret = await client.request(
      "/v1/assistant/interpretations",
      json({ text: "Vendí dos cafés", source: "text" }),
    );
    expect(interpret.status).toBe(503);
    expect(await interpret.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
    const transcribe = await client.request("/v1/assistant/transcriptions", audio(wave(16)));
    expect(transcribe.status).toBe(503);
    expect(calls.extract).toHaveLength(0);
    expect(calls.transcribe).toHaveLength(0);
  });

  test("reports the assistant on when a provider is composed", async () => {
    const { client } = setup();
    const status = await client.request("/v1/assistant/status");
    expect(await status.json()).toEqual({ data: { enabled: true, transcription: true } });
  });
});

describe("interpretations", () => {
  test("returns a contract-valid draft resolved through the directory", async () => {
    const { client, consumed, lookups } = setup();
    const response = await client.request(
      "/v1/assistant/interpretations",
      json({ text: "Vendí dos cafés", source: "text" }),
    );
    expect(response.status).toBe(200);
    const payload = assistantInterpretResponseSchema.parse(await response.json());
    expect(payload.data.interpretation.draft).toMatchObject({
      kind: "sale",
      totalMinorUnits: "650",
      account: { name: "Caja" },
    });
    expect(consumed).toEqual([
      "pisto:assistant:interpret:business_test:user_test",
      "pisto:assistant:business:business_test",
    ]);
    expect(lookups[0]?.actor).toEqual({
      userId: "user_test",
      sessionId: "session_test",
      activeBusinessId: "business_test",
    });
  });

  test("checks the session, then the membership, then the budget before any model call", async () => {
    const anonymous = setup({ authenticated: false });
    const unauthenticated = await anonymous.client.request(
      "/v1/assistant/interpretations",
      json({ text: "Vendí dos cafés", source: "text" }),
    );
    expect(unauthenticated.status).toBe(401);
    expect(anonymous.calls.extract).toHaveLength(0);

    const denied = setup({
      authorize: async () => {
        throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
      },
    });
    const forbidden = await denied.client.request(
      "/v1/assistant/interpretations",
      json({ text: "Vendí dos cafés", source: "text" }),
    );
    expect(forbidden.status).toBe(403);
    expect(denied.consumed).toEqual([]);
    expect(denied.calls.extract).toHaveLength(0);

    const limited = setup({ allowed: (key) => !key.includes(":business:") });
    const tooMany = await limited.client.request(
      "/v1/assistant/interpretations",
      json({ text: "Vendí dos cafés", source: "text" }),
    );
    expect(tooMany.status).toBe(429);
    expect(tooMany.headers.get("retry-after")).toBe("42");
    expect(await tooMany.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(limited.calls.extract).toHaveLength(0);
  });

  test("rejects invalid sentences and client-chosen tenants", async () => {
    const { client, calls } = setup();
    for (const body of [
      { text: "x", source: "text" },
      { text: "a".repeat(1_001), source: "text" },
      { text: "Vendí dos cafés", source: "chat" },
      { text: "Vendí dos cafés", source: "text", businessId: "business_other" },
    ]) {
      const response = await client.request("/v1/assistant/interpretations", json(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    }
    expect(calls.extract).toHaveLength(0);
  });

  test("a provider failure is SERVICE_UNAVAILABLE and the sentence never reaches the logs", async () => {
    const info = spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const { client } = setup({ extract: () => new Error("provider down") });
      const response = await client.request(
        "/v1/assistant/interpretations",
        json({ text: "Vendí dos cafés secretos a don Carlos", source: "voice" }),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
      const logged = info.mock.calls.map((call) => String(call[0])).join("\n");
      expect(logged).toContain('"outcome":"provider_unavailable"');
      expect(logged).not.toContain("secretos");
      expect(logged).not.toContain("Carlos");
    } finally {
      info.mockRestore();
    }
  });
});

describe("transcriptions", () => {
  test("transcribes a WAV body above the JSON limit and returns trimmed text", async () => {
    const { client, calls, consumed } = setup();
    const body = wave(1_500);
    expect(body.byteLength).toBeGreaterThan(jsonLimitBytes);
    const response = await client.request("/v1/assistant/transcriptions", audio(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { text: "Vendí dos cafés" } });
    expect(calls.transcribe[0]?.byteLength).toBe(body.byteLength);
    expect(consumed[0]).toBe("pisto:assistant:transcribe:business_test:user_test");
  });

  test("accepts only WAV from an allowlisted origin within the audio limit", async () => {
    const { client, calls } = setup();
    const cases: Array<[RequestInit, number]> = [
      [audio(wave(16), { "content-type": "audio/webm" }), 415],
      [audio(wave(16), { "content-type": "application/json" }), 415],
      [audio(new Uint8Array(new ArrayBuffer(64))), 415],
      [{ method: "POST", headers: { "content-type": "audio/wav" }, body: wave(16) }, 403],
      [audio(wave(16), { origin: "https://evil.example.test" }), 403],
      [audio(wave(16), { "content-length": String(audioLimitBytes + 1) }), 413],
    ];
    for (const [init, status] of cases) {
      const response = await client.request("/v1/assistant/transcriptions", init);
      expect(response.status).toBe(status);
    }
    expect(calls.transcribe).toHaveLength(0);
  });

  test("bounds a streamed body without a declared length", async () => {
    const { client, calls } = setup();
    const chunk = wave(1_024);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < 4; index += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const response = await client.request(
      new Request("http://localhost/v1/assistant/transcriptions", {
        ...audio(stream),
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(calls.transcribe).toHaveLength(0);
  });

  test("the audio exception applies to the transcription path only", async () => {
    const { client } = setup();
    const response = await client.request("/v1/assistant/interpretations", audio(wave(16)));
    expect(response.status).toBe(415);
    const large = await client.request(
      "/v1/assistant/interpretations",
      json({ text: "a".repeat(jsonLimitBytes), source: "text" }),
    );
    expect(large.status).toBe(413);
  });

  test("a transcription failure is SERVICE_UNAVAILABLE", async () => {
    const { client } = setup({ transcribe: () => new Error("down") });
    const response = await client.request("/v1/assistant/transcriptions", audio(wave(16)));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
  });
});

describe("assistant configuration", () => {
  const binding = { run: async () => ({}) };

  test("requires both REST credentials or neither", () => {
    expect(() => parseApiConfig({ CLOUDFLARE_ACCOUNT_ID: "account" })).toThrow(
      "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN must be set together",
    );
    expect(parseApiConfig({}).assistant).toMatchObject({ enabled: null, rest: null });
    expect(() => parseApiConfig({ ASSISTANT_ENABLED: "yes" })).toThrow("ASSISTANT_ENABLED");
  });

  test("is on exactly when a provider exists, and the kill switch wins", () => {
    const config = (env: Record<string, string>) => parseApiConfig(env).assistant;
    expect(assistantProvider(config({}), undefined)).toBeNull();
    expect(assistantProvider(config({}), binding)?.name).toBe("workers-ai-binding");
    const rest = { CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_AI_API_TOKEN: "token" };
    expect(assistantProvider(config(rest), undefined)?.name).toBe("workers-ai-rest");
    expect(assistantProvider(config({ ...rest, ASSISTANT_ENABLED: "false" }), binding)).toBeNull();
    expect(() => assistantProvider(config({ ASSISTANT_ENABLED: "true" }), undefined)).toThrow(
      ApiConfigurationError,
    );
  });
});
