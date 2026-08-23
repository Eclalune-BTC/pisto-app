import { createInstance, type TFunction } from "i18next";
import { beforeAll, describe, expect, test } from "vitest";

import { esSV } from "@/i18n/resources/es-SV";
import { ApiClientError } from "@/lib/api-error";
import { productErrorMessage } from "@/lib/product-errors";

import { isDeniedError, mutationUiState } from "./state";

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

describe("catalog and inventory controller states", () => {
  test("keeps an uncertain mutation on the exact-command retry path", () => {
    const error = new ApiClientError("unreachable", 0);
    expect(mutationUiState({ error, isPending: false })).toBe("uncertain");
    expect(mutationUiState({ error: null, isPending: true })).toBe("pending");
  });

  test("distinguishes denied reads and bounded conflict copy", () => {
    const denied = new ApiClientError("raw server detail", 403, "FORBIDDEN");
    const conflict = new ApiClientError("raw server detail", 409, "CONFLICT");
    const message = productErrorMessage(conflict, "fallback", t, "movement");

    expect(isDeniedError(denied)).toBe(true);
    expect(message).toContain("existencia");
    expect(message).not.toContain("raw server detail");
  });

  test("keeps every mutation context distinct from the flat reason table", () => {
    const conflict = new ApiClientError("raw server detail", 409, "CONFLICT");
    const contexts = ["archiveProduct", "category", "movement", "product", "reversal"] as const;
    const messages = contexts.map((context) =>
      productErrorMessage(conflict, "fallback", t, context),
    );

    expect(new Set(messages).size).toBe(contexts.length);
    expect(messages).not.toContain(esSV.productErrors.conflict);
  });
});
