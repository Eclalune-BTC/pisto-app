import { expect, test } from "bun:test";
import {
  type BusinessEvidence,
  createDeepSeekBusinessModel,
  parseBusinessPlan,
} from "../src/business-conversation.ts";

const question = {
  text: "¿Cuánto más vendimos en octubre que en septiembre?",
  previousQuestions: [],
};
const today = "2026-11-19";
const signal = AbortSignal.timeout(10_000);
function model(output: unknown) {
  const send = (async () =>
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }],
    })) as unknown as typeof fetch;
  return createDeepSeekBusinessModel("test", send);
}
test("grounds names in the thread, rejects tenant selectors and historical positions", () => {
  const read: ReturnType<typeof parseBusinessPlan> = {
    kind: "read",
    reads: [{ source: "customer", name: "María" }],
  };
  expect(parseBusinessPlan(read, question, today)).toEqual({ kind: "gap", reason: "name" });
  expect(
    parseBusinessPlan(
      read,
      { text: "¿Y lo vencido?", previousQuestions: ["¿Cuánto debe María?"] },
      today,
    ),
  ).toEqual(read);
  expect(() => parseBusinessPlan({ ...read, businessId: "another" }, question, today)).toThrow();
  expect(() =>
    parseBusinessPlan(
      { kind: "read", reads: [{ source: "cash", period: "last_month" }] },
      question,
      today,
    ),
  ).toThrow();
});
const periods: BusinessEvidence[] = ["2026-09", "2026-10"].map((month, i) => ({
  source: "sales",
  facts: [`las ventas brutas fueron USD ${i ? "950.10" : "900.00"}`],
  total: {
    currency: "USD",
    digits: 2,
    value: i ? "95010" : "90000",
    range: { startLocalDate: `${month}-01`, endLocalDate: `${month}-30` },
  },
}));
test("the model can cite a server-calculated difference across reads", async () => {
  const result = await model({ kind: "answer", text: "Según sus registros, {{f3}}." }).compose(
    question,
    periods,
    signal,
  );
  expect(result).toContain("las ventas brutas aumentaron en USD 50.10");
});
test.each([
  "Sus ganancias se duplicaron. {{f1}}.",
  "{{f1}} y USD 99.",
  "{{f1}}. {{f7}}.",
  "{{f1}}. {{F7}}.",
])("rejects unsupported wording or a missing fact: %s", async (text) => {
  await expect(
    model({ kind: "answer", text }).compose(question, periods.slice(0, 1), signal),
  ).rejects.toThrow();
});
