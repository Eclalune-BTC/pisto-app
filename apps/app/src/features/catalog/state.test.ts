import { createInstance, type TFunction } from "i18next";
import { beforeAll, describe, expect, test } from "vitest";

import { esSV } from "@/i18n/resources/es-SV";
import { ApiClientError } from "@/lib/api-error";
import { mutationPhase } from "@/lib/mutation-phase";
import { productErrorMessage } from "@/lib/product-errors";
import { hasStaleRead, readState } from "./state";

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

type Read = Parameters<typeof readState>[0][number];

function read(changes: Partial<Read> = {}): Read {
  return { data: { items: [] }, error: null, fetchStatus: "idle", isError: false, ...changes };
}

describe("catalog and inventory read states", () => {
  test("lets an access rejection override cached records", () => {
    const denied = new ApiClientError("Forbidden", 403, "FORBIDDEN");
    expect(readState([read(), read({ error: denied, isError: true })])).toBe("denied");
    expect(readState([read({ error: new ApiClientError("Expired", 401), isError: true })])).toBe(
      "denied",
    );
  });

  test("tells offline, missing and failed reads apart before calling anything loading", () => {
    expect(readState([read({ data: undefined, fetchStatus: "paused" })])).toBe("offline");
    expect(
      readState([
        read({
          data: undefined,
          error: new ApiClientError("Unreachable", 0),
          fetchStatus: "paused",
          isError: true,
        }),
      ]),
    ).toBe("offline");
    expect(
      readState([
        read({
          data: undefined,
          error: new ApiClientError("Missing", 404, "NOT_FOUND"),
          isError: true,
        }),
      ]),
    ).toBe("notFound");
    expect(
      readState([
        read({ data: undefined, error: new ApiClientError("Broken", 500), isError: true }),
      ]),
    ).toBe("error");
    expect(readState([read(), read({ data: undefined, fetchStatus: "fetching" })])).toBe("loading");
    expect(readState([read(), read()])).toBe("ready");
  });

  test("keeps cached records after a failed refresh and marks them stale", () => {
    const failed = read({ error: new ApiClientError("Broken", 500), isError: true });
    expect(readState([failed])).toBe("ready");
    expect(hasStaleRead([read(), failed])).toBe(true);
    expect(hasStaleRead([read({ fetchStatus: "paused" })])).toBe(true);
    expect(hasStaleRead([read(), read({ data: undefined, isError: true })])).toBe(false);
  });

  test("keeps a lost response on the exact-command retry path", () => {
    const lost = new ApiClientError("unreachable", 0);
    expect(mutationPhase({ error: lost, isError: true, isPending: false })).toBe("uncertain");
    expect(
      mutationPhase({
        error: new ApiClientError("The request payload is invalid.", 400, "VALIDATION_ERROR"),
        isError: true,
        isPending: false,
      }),
    ).toBe("failed");
  });

  test("gives every catalog and inventory command its own conflict sentence", () => {
    const conflict = new ApiClientError("raw server detail", 409, "CONFLICT");
    const contexts = ["archiveProduct", "category", "movement", "product", "reversal"] as const;
    const messages = contexts.map((context) =>
      productErrorMessage(conflict, "fallback", t, context),
    );

    expect(new Set(messages).size).toBe(contexts.length);
    expect(messages).not.toContain(esSV.productErrors.conflict);
    expect(messages.join(" ")).not.toContain("raw server detail");
    expect(productErrorMessage(conflict, "fallback", t, "movement")).toContain("existencia");
  });
});
