import { describe, expect, test } from "vitest";

import { ApiClientError } from "@/lib/api-error";

import { isDeniedError, mutationErrorMessage, mutationUiState } from "./state";

describe("catalog and inventory controller states", () => {
  test("keeps an uncertain mutation on the exact-command retry path", () => {
    const error = new ApiClientError("unreachable", 0);
    expect(mutationUiState({ error, isPending: false })).toBe("uncertain");
    expect(mutationUiState({ error: null, isPending: true })).toBe("pending");
  });

  test("distinguishes denied reads and bounded conflict copy", () => {
    const denied = new ApiClientError("raw server detail", 403, "FORBIDDEN");
    const conflict = new ApiClientError("raw server detail", 409, "CONFLICT");
    expect(isDeniedError(denied)).toBe(true);
    expect(mutationErrorMessage(conflict, "movement")).toContain("existencia");
    expect(mutationErrorMessage(conflict, "movement")).not.toContain("raw server detail");
  });
});
