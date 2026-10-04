import { describe, expect, test } from "bun:test";

import { EntitlementIntegrityError, recognizedSource } from "../src/entitlements.ts";

describe("entitlement source provenance", () => {
  test("recognizes only the three defined provider sources", () => {
    expect(recognizedSource("polar")).toBe("polar");
    expect(recognizedSource("revenuecat")).toBe("revenuecat");
    expect(recognizedSource("manual")).toBe("manual");
  });

  test("fails loudly on an unrecognized source instead of dropping or relabeling it", () => {
    for (const value of ["stripe", "", "POLAR", "apple", "unknown"]) {
      expect(() => recognizedSource(value)).toThrow(EntitlementIntegrityError);
    }
  });
});
