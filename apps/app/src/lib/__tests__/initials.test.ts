import { describe, expect, test } from "vitest";

import { initialsOf } from "@/lib/initials";

describe("avatar initials", () => {
  test("uses the first and last words", () => {
    expect(initialsOf("Tienda Luna del Mar")).toBe("TM");
    expect(initialsOf("  Óscar   Peña ")).toBe("ÓP");
  });

  test("uses two letters of a single word", () => {
    expect(initialsOf("pisto")).toBe("PI");
  });

  test("rejects an empty name instead of drawing a blank avatar", () => {
    expect(() => initialsOf("   ")).toThrow();
  });
});
