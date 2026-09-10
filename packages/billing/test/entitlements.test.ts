import { describe, expect, test } from "bun:test";

import { recognizedSource } from "../src/entitlements.ts";

describe("entitlement source provenance", () => {
  test("recognizes only the three defined provider sources", () => {
    expect(recognizedSource("polar")).toBe("polar");
    expect(recognizedSource("revenuecat")).toBe("revenuecat");
    expect(recognizedSource("manual")).toBe("manual");
  });

  test("never relabels an unrecognized source as the reserved manual override", () => {
    for (const value of ["stripe", "", "POLAR", "apple", "unknown"]) {
      expect(recognizedSource(value)).toBeNull();
    }
  });
});
