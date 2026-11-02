#!/usr/bin/env bun
/**
 * Runs the evaluation set through a running Pisto API, end to end: the configured model, the
 * deterministic post-processing and the demo business records. Usage:
 *
 *   bun ./eval/run.ts http://localhost:3193 http://localhost:8103
 *
 * The second argument is an allowed browser origin. The demo owner from scripts/seed.ts signs in
 * (EVAL_EMAIL / EVAL_PASSWORD override it). Prints one line per case and a JSON summary.
 */
import { assistantInterpretResponseSchema } from "@pisto/contracts";
import { assistantModels } from "../src/models.ts";
import { extractionPromptVersion } from "../src/prompt.ts";
import {
  type EvaluationCase,
  type Expectation,
  evaluationCases,
  evaluationSetVersion,
} from "./cases.ts";

function mismatches(actual: unknown, expected: Expectation | unknown, path: string): string[] {
  if (expected instanceof RegExp) {
    return typeof actual === "string" && expected.test(actual)
      ? []
      : [`${path}: ${JSON.stringify(actual)} !~ ${expected}`];
  }
  if (expected === null || typeof expected !== "object") {
    return actual === expected
      ? []
      : [`${path}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`];
  }
  if (actual === null || typeof actual !== "object") {
    return [`${path}: ${JSON.stringify(actual)} is not an object`];
  }
  return Object.entries(expected).flatMap(([key, value]) =>
    mismatches((actual as Record<string, unknown>)[key], value, `${path}.${key}`),
  );
}

async function signIn(api: string, origin: string): Promise<string> {
  const response = await fetch(`${api}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      email: process.env.EVAL_EMAIL ?? "dueno@pisto.test",
      password: process.env.EVAL_PASSWORD ?? "PistoDemo2026",
    }),
  });
  if (!response.ok) throw new Error(`Sign-in failed with ${response.status}`);
  const cookies = response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]);
  if (cookies.length === 0) throw new Error("Sign-in returned no session cookie");
  const cookie = cookies.join("; ");
  // A new sign-in has no active business; select the first membership like the app does.
  const listed = await fetch(`${api}/v1/businesses`, { headers: { origin, cookie } });
  const businesses = (await listed.json()) as { data: { items: Array<{ id: string }> } };
  const business = businesses.data.items[0];
  if (!business) throw new Error("The evaluation account has no business");
  const selected = await fetch(`${api}/api/auth/organization/set-active`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie },
    body: JSON.stringify({ organizationId: business.id }),
  });
  if (!selected.ok) throw new Error(`Selecting the business failed with ${selected.status}`);
  return cookie;
}

async function run(api: string, origin: string, cookie: string, testCase: EvaluationCase) {
  const startedAt = performance.now();
  const response = await fetch(`${api}/v1/assistant/interpretations`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie },
    body: JSON.stringify({ text: testCase.text, source: "text" }),
  });
  const latencyMs = Math.round(performance.now() - startedAt);
  const payload: unknown = await response.json();
  if (!response.ok) {
    return {
      id: testCase.id,
      pass: false,
      latencyMs,
      problems: [`HTTP ${response.status}: ${JSON.stringify(payload)}`],
    };
  }
  const { interpretation } = assistantInterpretResponseSchema.parse(payload).data;
  const problems = mismatches(interpretation, testCase.expect, "interpretation");
  if (testCase.minSpans !== undefined && interpretation.spans.length < testCase.minSpans) {
    problems.push(`spans: ${interpretation.spans.length} < ${testCase.minSpans}`);
  }
  return {
    id: testCase.id,
    pass: problems.length === 0,
    latencyMs,
    problems,
    notices: interpretation.notices.map((notice) => `${notice.code}:${notice.field}`),
  };
}

const [api = "http://localhost:3193", origin = "http://localhost:8103"] = process.argv.slice(2);
const cookie = await signIn(api, origin);
const results = [];
for (const testCase of evaluationCases) {
  const result = await run(api, origin, cookie, testCase);
  results.push(result);
  console.info(
    `${result.pass ? "PASS" : "FAIL"} ${result.id} ${result.latencyMs} ms${result.problems.length ? `\n  ${result.problems.join("\n  ")}` : ""}`,
  );
}
const latencies = results.map((result) => result.latencyMs).sort((left, right) => left - right);
console.info(
  JSON.stringify(
    {
      evaluationSetVersion,
      promptVersion: extractionPromptVersion,
      model: assistantModels["assistant.extract"].id,
      passed: results.filter((result) => result.pass).length,
      total: results.length,
      p50Ms: latencies[Math.floor(latencies.length / 2)],
      p95Ms: latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)],
    },
    null,
    2,
  ),
);
