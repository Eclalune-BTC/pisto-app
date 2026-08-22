import { describe, expect, it } from "vitest";

import { requireConfirmedSignOut } from "@/lib/sign-out";

describe("confirmed sign-out", () => {
  it("resolves only when the request has no error", async () => {
    await expect(requireConfirmedSignOut(async () => ({ error: null }))).resolves.toBeUndefined();
  });

  it("rejects a failed server sign-out", async () => {
    const providerError = new Error("network unavailable");

    await expect(requireConfirmedSignOut(async () => ({ error: providerError }))).rejects.toThrow(
      "The server did not confirm sign-out.",
    );
  });
});
