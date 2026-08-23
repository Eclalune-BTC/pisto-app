import { describe, expect, test } from "vitest";

import { formatMinorUnits, parseAmountToMinorUnits, toDecimalString } from "@/lib/money";

describe("minor-unit decimal text", () => {
  test("keeps the sign and the scale exact on both sides of zero", () => {
    expect(toDecimalString("0", 2)).toBe("0.00");
    expect(toDecimalString("5", 2)).toBe("0.05");
    expect(toDecimalString("1250", 2)).toBe("12.50");
    expect(toDecimalString("-1", 2)).toBe("-0.01");
    expect(toDecimalString("-5", 2)).toBe("-0.05");
    expect(toDecimalString("-50", 2)).toBe("-0.50");
    expect(toDecimalString("-99", 2)).toBe("-0.99");
    expect(toDecimalString("-100", 2)).toBe("-1.00");
    expect(toDecimalString("-5", 3)).toBe("-0.005");
    expect(toDecimalString("-500", 3)).toBe("-0.500");
    expect(toDecimalString("-5", 0)).toBe("-5");
  });

  test("stays exact past the double-precision range", () => {
    expect(toDecimalString("9223372036854775807", 2)).toBe("92233720368547758.07");
    expect(toDecimalString("-9223372036854775807", 2)).toBe("-92233720368547758.07");
  });

  test("refuses anything that is not canonical minor-unit text", () => {
    for (const value of ["", "abc", " 12", "+50", "012", "-0", "1.5"]) {
      expect(() => toDecimalString(value, 2)).toThrow(TypeError);
    }
  });

  test("refuses an unsupported currency exponent", () => {
    for (const digits of [-1, 1.5, 5]) {
      expect(() => toDecimalString("1250", digits)).toThrow(RangeError);
    }
  });
});

describe("money formatting", () => {
  test("renders a negative amount with the locale's own sign placement", () => {
    expect(formatMinorUnits("-5", "USD", 2, "en-US")).toBe("-$0.05");
    expect(formatMinorUnits("-50", "USD", 2, "en-US")).toBe("-$0.50");
    expect(formatMinorUnits("-99", "USD", 2, "en-US")).toBe("-$0.99");
    expect(formatMinorUnits("-100", "USD", 2, "en-US")).toBe("-$1.00");
    // ICU separates the code with a non-breaking space, so assert the parts.
    const kwd = formatMinorUnits("-500", "KWD", 3, "en-US");
    expect(kwd.startsWith("-KWD")).toBe(true);
    expect(kwd.endsWith("0.500")).toBe(true);
    expect(formatMinorUnits("-123456789", "USD", 2, "es-SV")).toBe("-$1,234,567.89");
  });

  test("renders positive amounts and honours the record's stored exponent", () => {
    expect(formatMinorUnits("1250", "USD", 2, "es-SV")).toBe("$12.50");
    expect(formatMinorUnits("0", "USD", 2, "es-SV")).toBe("$0.00");
    // The snapshot exponent wins over the currency's default digits.
    expect(formatMinorUnits("1234", "JPY", 2, "en-US")).toBe("¥12.34");
    expect(formatMinorUnits("1234", "CLP", 0, "es-CL")).toBe("$1.234");
  });

  test("renders every digit in the locale's own numbering system", () => {
    // Splicing an ASCII fraction into an Arabic-Indic result produced "١٢٫50".
    expect(formatMinorUnits("1250", "EGP", 2, "ar-EG")).not.toMatch(/[0-9]/);
  });

  test("renders every amount the parser and contracts accept, exactly", () => {
    // Anything parseAmountToMinorUnits will produce must be renderable, or a
    // legitimate entry crashes the screen that displays it back.
    const beyondDouble = parseAmountToMinorUnits("45035996273704.97", 2);
    expect(beyondDouble).toEqual({ value: "4503599627370497" });
    expect(formatMinorUnits("4503599627370497", "USD", 2, "en-US")).toBe("$45,035,996,273,704.97");
    // The contracts accept signed int64; rendering must stay exact there too,
    // which routing the value through a double would not.
    expect(formatMinorUnits("9223372036854775807", "USD", 2, "en-US")).toBe(
      "$92,233,720,368,547,758.07",
    );
    expect(formatMinorUnits("-9223372036854775807", "USD", 2, "en-US")).toBe(
      "-$92,233,720,368,547,758.07",
    );
  });

  test("refuses malformed input instead of rendering a plausible zero", () => {
    for (const value of ["", "abc", " 12", "+50"]) {
      expect(() => formatMinorUnits(value, "USD", 2, "en-US")).toThrow();
    }
  });
});

describe("money parsing", () => {
  test("parses decimal input without floating-point arithmetic", () => {
    expect(parseAmountToMinorUnits("12.50", 2)).toEqual({ value: "1250" });
    expect(parseAmountToMinorUnits("12,5", 2)).toEqual({ value: "1250" });
    expect(parseAmountToMinorUnits("0.1", 2)).toEqual({ value: "10" });
    expect(parseAmountToMinorUnits("00012.50", 2)).toEqual({ value: "1250" });
    expect(parseAmountToMinorUnits(" 12.50 ", 2)).toEqual({ value: "1250" });
  });

  test("rejects a group separator instead of silently reading it as a decimal point", () => {
    // "1,500" at a three-digit exponent used to return 1500 minor units, which
    // is 1.500 of the currency: a thousandfold understatement, silently.
    expect(parseAmountToMinorUnits("1,500", 3)).toHaveProperty("error");
    expect(parseAmountToMinorUnits("1,234", 3)).toHaveProperty("error");
    expect(parseAmountToMinorUnits("2,000", 3)).toHaveProperty("error");
    expect(parseAmountToMinorUnits("1,234.56", 2)).toHaveProperty("error");
    expect(parseAmountToMinorUnits("1.234,56", 2)).toHaveProperty("error");
  });

  test("rejects non-positive, over-scaled, and malformed amounts", () => {
    expect(parseAmountToMinorUnits("0", 2)).toEqual({ error: "non-positive" });
    expect(parseAmountToMinorUnits("0.00", 2)).toEqual({ error: "non-positive" });
    expect(parseAmountToMinorUnits("12.345", 2)).toEqual({ error: "invalid-decimals" });
    expect(parseAmountToMinorUnits("12.", 2)).toEqual({ error: "invalid-decimals" });
    expect(parseAmountToMinorUnits("-12.50", 2)).toEqual({ error: "invalid-decimals" });
    expect(parseAmountToMinorUnits("1e3", 2)).toEqual({ error: "invalid-decimals" });
    expect(parseAmountToMinorUnits("12.50", 0)).toEqual({ error: "invalid-integer" });
  });

  test("holds the int64 boundary exactly", () => {
    expect(parseAmountToMinorUnits("92233720368547758.07", 2)).toEqual({
      value: "9223372036854775807",
    });
    expect(parseAmountToMinorUnits("92233720368547758.08", 2)).toEqual({ error: "too-large" });
  });

  test("refuses an unsupported currency exponent", () => {
    expect(() => parseAmountToMinorUnits("12.50", -1)).toThrow(RangeError);
    expect(() => parseAmountToMinorUnits("12.50", 5)).toThrow(RangeError);
  });
});
