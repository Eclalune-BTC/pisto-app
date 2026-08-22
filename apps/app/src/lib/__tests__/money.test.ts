import { describe, expect, test } from "vitest";

import { formatMinorUnits, parseAmountToMinorUnits } from "@/lib/money";

describe("money helpers", () => {
  test("parses decimal input without floating-point arithmetic", () => {
    expect(parseAmountToMinorUnits("12.50", 2)).toEqual({ value: "1250" });
    expect(parseAmountToMinorUnits("12,5", 2)).toEqual({ value: "1250" });
    expect(parseAmountToMinorUnits("0", 2)).toHaveProperty("error");
    expect(parseAmountToMinorUnits("12.345", 2)).toHaveProperty("error");
  });

  test("formats values beyond JavaScript's safe integer range exactly", () => {
    expect(formatMinorUnits("900719925474099301", "USD", 2, "en-US")).toBe(
      "$9,007,199,254,740,993.01",
    );
  });
});
