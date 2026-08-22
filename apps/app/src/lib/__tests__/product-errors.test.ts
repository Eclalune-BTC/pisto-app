import { createInstance, type TFunction } from "i18next";
import { beforeAll, describe, expect, test } from "vitest";

import { esSV } from "@/i18n/resources/es-SV";
import { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";
import { productErrorMessage } from "@/lib/product-errors";

const translator = createInstance();
let t: TFunction;

beforeAll(async () => {
  await translator.init({
    initAsync: false,
    lng: "es-SV",
    resources: { "es-SV": { translation: esSV } },
  });
  t = translator.t.bind(translator);
});

describe("product error presentation", () => {
  test.each([
    ["BUSINESS_REQUIRED", esSV.productErrors.businessRequired],
    ["CONFLICT", esSV.productErrors.conflict],
    ["FORBIDDEN", esSV.productErrors.forbidden],
    ["IDEMPOTENCY_CONFLICT", esSV.productErrors.idempotencyConflict],
    ["NOT_FOUND", esSV.productErrors.notFound],
    ["UNAUTHORIZED", esSV.productErrors.unauthorized],
    ["VALIDATION_ERROR", esSV.productErrors.validation],
  ] as const)("maps %s to catalog-owned copy", (code, expected) => {
    const message = productErrorMessage(
      new ApiClientError("raw server detail", 400, code),
      "fallback",
      t,
    );

    expect(message).toBe(expected);
    expect(message).not.toContain("raw");
  });

  test("maps network failures to catalog-owned copy", () => {
    const network = productErrorMessage(new ApiClientError("raw network detail", 0), "fallback", t);

    expect(network).toBe(esSV.productErrors.connection);
    expect(network).not.toContain("raw");
  });

  test("uses caller-owned fallback copy for unknown and non-client errors", () => {
    const fallback = "No pudimos completar la operaciÃ³n.";
    const unknown = productErrorMessage(new ApiClientError("raw server detail", 500), fallback, t);
    const nonClient = productErrorMessage(new Error("raw local detail"), fallback, t);

    expect(unknown).toBe(fallback);
    expect(nonClient).toBe(fallback);
    expect(`${unknown} ${nonClient}`).not.toContain("raw");
  });
});

describe("ambiguous mutation failures", () => {
  test.each([
    { expected: true, status: 0 },
    { expected: true, status: 200 },
    { expected: true, status: 299 },
    { expected: false, status: 400 },
    { expected: false, status: 409 },
    { expected: false, status: 499 },
    { expected: true, status: 500 },
    { expected: true, status: 503 },
  ])("classifies status $status as ambiguous=$expected", ({ status, expected }) => {
    expect(isAmbiguousMutationError(new ApiClientError("internal detail", status))).toBe(expected);
  });

  test("does not classify unrelated errors as ambiguous", () => {
    expect(isAmbiguousMutationError(new Error("local failure"))).toBe(false);
  });
});
