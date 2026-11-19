import { describe, expect, spyOn, test } from "bun:test";
import {
  type AssistantProvider,
  blankExtraction,
  type CatalogModel,
  type Extraction,
  emptySupplierDirectory,
} from "@pisto/assistant";
import { createFakeAssistantProvider } from "@pisto/assistant/testing";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import {
  assistantInterpretResponseSchema,
  assistantScopeHeader,
  businessAnswerResponseSchema,
  catalogTurnResponseSchema,
  type Product,
  type SalesPeriodSummary,
} from "@pisto/contracts";
import {
  type AssistantDirectoryRepository,
  type CatalogRepository,
  type DatabaseHandle,
  type ProductActor,
  ProductError,
  type SalesRepository,
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
    catalogModel?: CatalogModel;
    getProduct?: CatalogRepository["getProduct"];
    getPeriodSummary?: SalesRepository["getPeriodSummary"];
    provider?: AssistantProvider;
  } = {},
) {
  const fake = createFakeAssistantProvider({
    extract: options.extract ?? (() => saleExtraction),
    transcribe: options.transcribe ?? (() => "  Vendí dos cafés  "),
  });
  const consumed: string[] = [];
  const lookups: Array<{ actor: ProductActor; terms: unknown }> = [];
  const records: AssistantDirectoryRepository = {
    authorize:
      options.authorize ?? (async () => ({ businessId: "business_test", localDate: "2026-11-04" })),
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
    provider: options.enabled === false ? null : (options.provider ?? fake.provider),
    catalogModel: options.catalogModel ?? null,
    records,
    suppliers: emptySupplierDirectory,
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
      catalog: options.getProduct
        ? {
            ...unavailable<CatalogRepository>("Catalog repository"),
            getProduct: options.getProduct,
          }
        : unavailable("Catalog repository"),
      members: unavailable("Business members repository"),
      debtors: unavailable("Debtors repository"),
      moneyTrend: unavailable("Money trend repository"),
      movements: unavailable("Movements repository"),
      purchases: unavailable("Purchases repository"),
      receivables: unavailable("Receivables repository"),
      reports: unavailable("Reports repository"),
      sales: options.getPeriodSummary
        ? {
            ...unavailable<SalesRepository>("Sales repository"),
            getPeriodSummary: options.getPeriodSummary,
          }
        : unavailable("Sales repository"),
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

describe("catalog conversation", () => {
  const product: Product = {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Café",
    status: "active",
    sku: null,
    categoryId: null,
    tracked: false,
    lowStockThresholdMinorUnits: null,
    quantityPrecision: 0,
    unitKind: "unit",
    sellingPriceCurrency: "USD",
    sellingPriceCurrencyMinorUnitDigits: 2,
    sellingPriceMinorUnits: "325",
    createdAt: "2026-11-18T12:00:00Z",
    updatedAt: "2026-11-18T12:00:00Z",
  };
  const request = {
    text: "¿y tres?",
    expectedBusinessId: "business_test",
    productId: product.id,
    previousQuantity: null,
  };
  const quote: CatalogModel = async () => ({
    intent: "quote",
    quantityText: "tres",
    usePrevious: false,
  });
  test("uses a freshly authorized price after the model returns and shares the interpretation budget", async () => {
    let reads = 0;
    const { client, consumed } = setup({
      catalogModel: quote,
      getProduct: async () => ({
        businessId: "business_test",
        stock: null,
        product: { ...product, sellingPriceMinorUnits: ++reads === 1 ? "300" : "325" },
      }),
    });
    const response = await client.request("/v1/assistant/catalog-turns", json(request));
    expect(response.status).toBe(200);
    expect(catalogTurnResponseSchema.parse(await response.json()).data.reply).toMatchObject({
      kind: "quote",
      totalMinorUnits: "975",
    });
    expect(reads).toBe(2);
    expect(consumed[0]).toBe("pisto:assistant:interpret:business_test:user_test");
  });
  test("refuses changed businesses or archived products before contacting DeepSeek", async () => {
    let calls = 0;
    const { client, consumed } = setup({
      catalogModel: async (arg) => {
        calls++;
        return quote(arg);
      },
      getProduct: async () => ({
        businessId: "business_test",
        stock: null,
        product: { ...product, status: "archived" },
      }),
    });
    expect(
      (
        await client.request(
          "/v1/assistant/catalog-turns",
          json({ ...request, expectedBusinessId: "another" }),
        )
      ).status,
    ).toBe(403);
    expect(consumed).toHaveLength(0);
    expect((await client.request("/v1/assistant/catalog-turns", json(request))).status).toBe(404);
    expect(calls).toBe(0);
  });
  test("refuses a sale proposal without sale permission and advertises the extension only on opt-in", async () => {
    const { client } = setup({
      catalogModel: async () => ({
        intent: "prepare_sale",
        quantityText: "tres",
        usePrevious: false,
      }),
      getProduct: async () => ({ businessId: "business_test", product, stock: null }),
      authorize: async (_actor, permissions) => {
        if (permissions?.includes("sales:create"))
          throw new ProductError("FORBIDDEN", "Sale is not permitted");
        return { businessId: "business_test", localDate: "2026-11-04" };
      },
    });
    expect((await client.request("/v1/assistant/catalog-turns", json(request))).status).toBe(403);
    expect(
      (await (await client.request("/v1/assistant/status?include=catalog")).json()).data
        .catalogConversation,
    ).toBe(true);
    expect(
      (await (await client.request("/v1/assistant/status")).json()).data.catalogConversation,
    ).toBeUndefined();
  });
});

describe("business answers", () => {
  const summary: SalesPeriodSummary = {
    grossMinorUnits: "9750",
    saleCount: "3",
    averageMinorUnits: "3250",
    itemizedSaleCount: "2",
    topProducts: [
      {
        productId: "10000000-0000-4000-8000-000000000001",
        name: "Café molido 1 lb",
        unitKind: "unit",
        quantityPrecision: 0,
        quantityMinorUnits: "6",
        grossMinorUnits: "1950",
      },
    ],
    businessLocalDate: "2026-11-04",
    currency: "USD",
    currencyMinorUnitDigits: 2,
    queriedAt: "2026-11-04T15:00:00.000Z",
  };
  const path = (query: string) => `/v1/assistant/answers?expectedBusinessId=business_test&${query}`;

  test("answers from the sales repository over the business week, with the model off", async () => {
    const ranges: unknown[] = [];
    const required: unknown[] = [];
    const { client, calls, consumed } = setup({
      enabled: false,
      authorize: async (_actor, permissions) => {
        required.push(permissions);
        return { businessId: "business_test", localDate: "2026-11-04" };
      },
      getPeriodSummary: async (_actor, range) => {
        ranges.push(range);
        return summary;
      },
    });
    const response = await client.request(path("topic=sales&period=this_week"));
    expect(response.status).toBe(200);
    expect(businessAnswerResponseSchema.parse(await response.json()).data.answer).toEqual({
      topic: "sales",
      period: { key: "this_week", startLocalDate: "2026-11-02", endLocalDate: "2026-11-04" },
      grossMinorUnits: "9750",
      saleCount: "3",
      averageMinorUnits: "3250",
      businessLocalDate: "2026-11-04",
      currency: "USD",
      currencyMinorUnitDigits: 2,
      queriedAt: "2026-11-04T15:00:00.000Z",
    });
    expect(ranges).toEqual([{ startLocalDate: "2026-11-02", endLocalDate: "2026-11-04" }]);
    expect(required).toEqual([["sales:summary:read"]]);
    expect(calls.extract).toHaveLength(0);
    expect(consumed).toHaveLength(0);
  });

  test("ranks products over the month in progress when the question names no period", async () => {
    const ranges: unknown[] = [];
    const { client } = setup({
      getPeriodSummary: async (_actor, range) => {
        ranges.push(range);
        return summary;
      },
    });
    const response = await client.request(path("topic=top_products"));
    expect(response.status).toBe(200);
    expect(businessAnswerResponseSchema.parse(await response.json()).data.answer).toMatchObject({
      topic: "top_products",
      period: { key: "this_month", startLocalDate: "2026-11-01", endLocalDate: "2026-11-04" },
      saleCount: "3",
      itemizedSaleCount: "2",
      products: [{ name: "Café molido 1 lb", quantityMinorUnits: "6" }],
    });
    expect(ranges).toEqual([{ startLocalDate: "2026-11-01", endLocalDate: "2026-11-04" }]);
  });

  test("refuses a changed business and a denied role before any read", async () => {
    let reads = 0;
    const getPeriodSummary = async () => {
      reads += 1;
      return summary;
    };
    const changed = setup({ getPeriodSummary });
    expect(
      (
        await changed.client.request(
          "/v1/assistant/answers?expectedBusinessId=another_business&topic=sales",
        )
      ).status,
    ).toBe(403);
    const denied = setup({
      getPeriodSummary,
      authorize: async () => {
        throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
      },
    });
    expect((await denied.client.request(path("topic=sales"))).status).toBe(403);
    expect(reads).toBe(0);
  });

  test("rejects unknown topics, periods, extra keys and anonymous callers", async () => {
    const { client } = setup({ getPeriodSummary: async () => summary });
    for (const query of [
      "topic=profit",
      "topic=sales&period=2026",
      "topic=sales&businessId=business_test",
      "topic=sales&topic=cash",
      "topic=cash&period=today",
    ]) {
      expect((await client.request(path(query))).status).toBe(400);
    }
    expect((await client.request("/v1/assistant/answers?topic=sales")).status).toBe(400);
    const anonymous = setup({ authenticated: false });
    expect((await anonymous.client.request(path("topic=sales"))).status).toBe(401);
  });

  test("a read failure is an error, never an empty answer", async () => {
    const { client } = setup({
      getPeriodSummary: async () => {
        throw new Error("The database is unreachable");
      },
    });
    const response = await client.request(path("topic=sales&period=today"));
    expect(response.status).toBe(500);
    expect((await response.json()).data).toBeUndefined();
  });
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
  test.each([
    [undefined, 400],
    ["different-business", 403],
  ] as const)(
    "requires the authorized business for tool requests (%s)",
    async (expectedBusinessId, status) => {
      const { client, calls, consumed, lookups } = setup();
      const response = await client.request(
        "/v1/assistant/interpretations",
        json({
          text: "Quiero ingresar ventas",
          source: "text",
          allowTools: true,
          expectedBusinessId,
        }),
      );
      expect(response.status).toBe(status);
      expect(consumed).toHaveLength(0);
      expect(calls.extract).toHaveLength(0);
      expect(lookups).toHaveLength(0);
    },
  );

  test("returns a sale tool for the authorized business without a financial lookup", async () => {
    const { client, lookups } = setup({
      extract: () => ({ ...blankExtraction, kind: "start_sale" }),
    });
    const response = await client.request(
      "/v1/assistant/interpretations",
      json({
        text: "Quiero ingresar ventas",
        source: "text",
        allowTools: true,
        expectedBusinessId: "business_test",
      }),
    );
    expect(response.status).toBe(200);
    expect(
      assistantInterpretResponseSchema.parse(await response.json()).data.interpretation.tool,
    ).toEqual({ name: "start_sale" });
    expect(lookups).toHaveLength(0);
  });

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
  test("rejects a business switch before charging or transcribing the recording", async () => {
    const { client, calls, consumed } = setup();
    const response = await client.request(
      "/v1/assistant/transcriptions",
      audio(wave(16), { [assistantScopeHeader]: "different-business" }),
    );
    expect(response.status).toBe(403);
    expect(consumed).toHaveLength(0);
    expect(calls.transcribe).toHaveLength(0);
  });
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

  test("rejects a transcript over the limit without returning a truncated sentence", async () => {
    const { client } = setup({ transcribe: () => "a".repeat(2001) });
    const response = await client.request("/v1/assistant/transcriptions", audio(wave(16)));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });
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

  test("reads sentences with DeepSeek only when it is selected and has its key", () => {
    const config = (env: Record<string, string>) => parseApiConfig(env).assistant;
    expect(config({}).extraction).toBe("workers-ai");
    expect(() => config({ ASSISTANT_EXTRACTION_PROVIDER: "openai" })).toThrow(
      "ASSISTANT_EXTRACTION_PROVIDER must be workers-ai or deepseek",
    );
    expect(() => config({ ASSISTANT_EXTRACTION_PROVIDER: "deepseek" })).toThrow(
      "ASSISTANT_EXTRACTION_PROVIDER=deepseek requires DEEPSEEK_API_KEY",
    );
    // A key alone changes nothing: the catalog follow-ups use it, extraction stays where it was.
    expect(assistantProvider(config({ DEEPSEEK_API_KEY: "key" }), binding)?.name).toBe(
      "workers-ai-binding",
    );
    const selected = { DEEPSEEK_API_KEY: "key", ASSISTANT_EXTRACTION_PROVIDER: "deepseek" };
    expect(assistantProvider(config(selected), binding)).toMatchObject({
      name: "deepseek+workers-ai-binding",
      transcribes: true,
    });
    expect(assistantProvider(config(selected), undefined)).toMatchObject({
      name: "deepseek",
      transcribes: false,
    });
    expect(
      assistantProvider(config({ ...selected, ASSISTANT_ENABLED: "false" }), binding),
    ).toBeNull();
  });
});

describe("an assistant without a speech model", () => {
  test("offers no dictation and refuses a recording before charging it", async () => {
    const fake = createFakeAssistantProvider({ extract: () => saleExtraction });
    const { client, consumed } = setup({ provider: { ...fake.provider, transcribes: false } });
    expect((await (await client.request("/v1/assistant/status")).json()).data).toEqual({
      enabled: true,
      transcription: false,
    });
    expect((await client.request("/v1/assistant/transcriptions", audio(wave(8)))).status).toBe(503);
    expect(consumed).toHaveLength(0);
    const read = await client.request(
      "/v1/assistant/interpretations",
      json({ text: "Vendí dos cafés", source: "text" }),
    );
    expect(read.status).toBe(200);
  });
});
