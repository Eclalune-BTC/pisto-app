import { describe, expect, test } from "bun:test";

import { createFakeAssistantProvider } from "../src/fake-provider.ts";
import {
  blankExtraction,
  createDeepSeekProvider,
  deepSeekModelId,
  extractionJsonSchema,
  extractionMessages,
} from "../src/index.ts";

type Sent = { url: string; init: RequestInit; body: Record<string, unknown> };

function vendor(reply: (sent: Sent) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const send = async function (this: unknown, url: string | URL | Request, init: RequestInit = {}) {
    // The Workers runtime throws this when fetch is called as a method of another object.
    if (this !== undefined) throw new TypeError("Illegal invocation");
    const call = { url: String(url), init, body: JSON.parse(String(init.body)) };
    sent.push(call);
    return reply(call);
  } as typeof fetch;
  return { send, sent };
}

const completion = (content: string, finish_reason = "stop", status = 200) =>
  Response.json({ choices: [{ finish_reason, message: { content } }] }, { status });

const extract = (provider: ReturnType<typeof createDeepSeekProvider>, signal?: AbortSignal) =>
  provider.extract({
    messages: extractionMessages("¿Cuánto vendí hoy?", true),
    jsonSchema: extractionJsonSchema,
    signal: signal ?? AbortSignal.timeout(1_000),
  });

describe("DeepSeek extraction", () => {
  test("sends the prompt with the schema after the instructions and returns the object", async () => {
    const answer = {
      ...blankExtraction,
      kind: "ask",
      question: { topic: "sales", period: "today" },
    };
    const { send, sent } = vendor(() => completion(JSON.stringify(answer)));
    const provider = createDeepSeekProvider("secret-key", null, send);
    expect(await extract(provider)).toEqual(answer);

    const [call] = sent;
    expect(call?.url).toBe("https://api.deepseek.com/chat/completions");
    expect(call?.init.redirect).toBe("manual");
    expect(new Headers(call?.init.headers).get("authorization")).toBe("Bearer secret-key");
    expect(call?.body).toMatchObject({
      model: deepSeekModelId,
      temperature: 0,
      stream: false,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
    const messages = call?.body.messages as Array<{ role: string; content: string }>;
    const prompt = extractionMessages("¿Cuánto vendí hoy?", true);
    expect(messages).toHaveLength(prompt.length + 1);
    expect(messages[0]).toEqual(prompt[0] as (typeof messages)[number]);
    expect(messages[1]?.role).toBe("system");
    expect(messages[1]?.content).toContain(JSON.stringify(extractionJsonSchema));
    expect(messages.at(-1)).toEqual(prompt.at(-1) as (typeof messages)[number]);
    // The key travels in the header only.
    expect(JSON.stringify(call?.body)).not.toContain("secret-key");
  });

  test.each([
    ["an HTTP failure", () => completion("{}", "stop", 429), "unavailable"],
    ["a redirect", () => new Response(null, { status: 307 }), "unavailable"],
    ["a cut answer", () => completion('{"kind":', "length"), "invalid_output"],
    ["text that is not JSON", () => completion("Vendió mucho hoy."), "invalid_output"],
    ["an unexpected body", () => Response.json({ output: "{}" }), "invalid_output"],
    ["an answer without choices", () => Response.json({ choices: [] }), "invalid_output"],
    [
      "a refused connection",
      () => {
        throw Object.assign(new Error("Unable to connect"), { code: "ConnectionRefused" });
      },
      "unavailable",
    ],
  ] as const)("%s is a provider failure and never a guess", async (_name, reply, reason) => {
    const { send } = vendor(reply);
    await expect(extract(createDeepSeekProvider("key", null, send))).rejects.toMatchObject({
      name: "AssistantProviderError",
      reason,
    });
  });

  test("a call that outlives its signal is a timeout", async () => {
    const { send } = vendor(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted")));
        }),
    );
    await expect(
      extract(createDeepSeekProvider("key", null, send), AbortSignal.timeout(20)),
    ).rejects.toMatchObject({ reason: "timeout" });
  });

  test("dictation stays with the speech provider, or is unavailable without one", async () => {
    const { send } = vendor(() => completion("{}"));
    const speech = createFakeAssistantProvider({ transcribe: () => "Vendí dos cafés" });
    const composed = createDeepSeekProvider("key", speech.provider, send);
    expect(composed).toMatchObject({ name: "deepseek+fake", transcribes: true });
    const input = { audio: new Uint8Array([1, 2, 3]), signal: AbortSignal.timeout(1_000) };
    expect(await composed.transcribe(input)).toBe("Vendí dos cafés");
    expect(speech.calls.extract).toHaveLength(0);

    const alone = createDeepSeekProvider("key", null, send);
    expect(alone).toMatchObject({ name: "deepseek", transcribes: false });
    await expect(alone.transcribe(input)).rejects.toMatchObject({ reason: "unavailable" });
  });
});
