import { describe, expect, test } from "bun:test";

import {
  decimalToMinorUnits,
  extractionJsonSchema,
  extractionSchema,
  fold,
  lineSubtotal,
  matchName,
  resolveDate,
  searchTerms,
} from "../src/index.ts";
import { findOccurrences } from "../src/text.ts";

describe("money", () => {
  test.each([
    ["5", 2, 500n],
    ["5.5", 2, 550n],
    ["64.00", 2, 6400n],
    ["0.10", 2, 10n],
    ["12.500", 2, 1250n],
    ["7", 0, 7n],
    ["1.234", 3, 1234n],
  ])("%s with %i digits is %p minor units", (value, digits, expected) => {
    expect(decimalToMinorUnits(value, digits)).toBe(expected);
  });

  test.each([
    ["3.255", 2],
    ["1,50", 2],
    ["-5", 2],
    ["5 dólares", 2],
    ["1e3", 2],
    ["", 2],
    ["9999999999999999", 2],
  ])("%s with %i digits is rejected rather than rounded or guessed", (value, digits) => {
    expect(decimalToMinorUnits(value, digits)).toBeNull();
  });

  test("line subtotals scale the quantity and round half up to the currency unit", () => {
    expect(lineSubtotal(3n, 0, 325n)).toBe(975n);
    // 1.5 kg at 2.33 = 3.495 -> 3.50
    expect(lineSubtotal(1_500n, 3, 233n)).toBe(350n);
    // 0.25 lb at 1.01 = 0.2525 -> 0.25
    expect(lineSubtotal(25n, 2, 101n)).toBe(25n);
    expect(lineSubtotal(9_223_372_036_854_775_807n, 0, 2n)).toBeNull();
  });
});

describe("dates in the business calendar", () => {
  const today = "2026-11-02"; // Monday
  const none = { offsetDays: null, weekday: null, day: null, month: null, year: null };

  test("an unspoken date is absent", () => {
    expect(resolveDate(null, today, "past")).toEqual({ kind: "absent" });
    expect(resolveDate(none, today, "past")).toEqual({ kind: "absent" });
  });

  test("relative, weekday and calendar dates resolve on the right side of today", () => {
    expect(resolveDate({ ...none, offsetDays: -2 }, today, "past")).toEqual({
      kind: "resolved",
      date: "2026-10-31",
    });
    expect(resolveDate({ ...none, weekday: "friday" }, today, "past")).toEqual({
      kind: "resolved",
      date: "2026-10-30",
    });
    expect(resolveDate({ ...none, weekday: "monday" }, today, "past")).toEqual({
      kind: "resolved",
      date: "2026-11-02",
    });
    expect(resolveDate({ ...none, weekday: "monday" }, today, "future")).toEqual({
      kind: "resolved",
      date: "2026-11-09",
    });
    // "el 28" said on the 2nd is last month's 28th for a sale.
    expect(resolveDate({ ...none, day: 28 }, today, "past")).toEqual({
      kind: "resolved",
      date: "2026-10-28",
    });
    expect(resolveDate({ ...none, day: 28, month: 12, year: null }, "2027-01-02", "past")).toEqual({
      kind: "resolved",
      date: "2026-12-28",
    });
  });

  test("a day the current month lacks resolves in the nearest month that has it", () => {
    // April has no 31st: a sale "el 31" is March 31, a due date "el 31" is May 31.
    expect(resolveDate({ ...none, day: 31 }, "2026-04-05", "past")).toEqual({
      kind: "resolved",
      date: "2026-03-31",
    });
    expect(resolveDate({ ...none, day: 31 }, "2026-04-05", "future")).toEqual({
      kind: "resolved",
      date: "2026-05-31",
    });
    expect(resolveDate({ ...none, day: 30 }, "2026-03-02", "past")).toEqual({
      kind: "resolved",
      date: "2026-01-30",
    });
    expect(resolveDate({ ...none, day: 5 }, "2026-04-05", "future")).toEqual({
      kind: "resolved",
      date: "2026-04-05",
    });
  });

  test("dates beyond the window, on the wrong side or not on the calendar are invalid", () => {
    expect(resolveDate({ ...none, offsetDays: -61 }, today, "past")).toEqual({ kind: "invalid" });
    expect(resolveDate({ ...none, offsetDays: 1 }, today, "past")).toEqual({ kind: "invalid" });
    expect(resolveDate({ ...none, day: 31, month: 9 }, today, "past")).toEqual({
      kind: "invalid",
    });
    expect(resolveDate({ ...none, day: 1, month: 1, year: 2025 }, today, "past")).toEqual({
      kind: "invalid",
    });
  });
});

describe("names and fragments", () => {
  test("folding keeps every index of the original text", () => {
    const sentence = "Doña Ana pagó el CAFÉ";
    expect(fold(sentence)).toBe("dona ana pago el cafe");
    expect(fold(sentence)).toHaveLength(sentence.length);
  });

  test("search terms drop titles and connectors and use singular stems", () => {
    expect(searchTerms("don Carlos")).toEqual(["carlo"]);
    expect(searchTerms("Doña Ana")).toEqual(["ana"]);
    expect(searchTerms("libras de cafés")).toEqual(["libra", "caf"]);
    expect(searchTerms("frijoles")).toEqual(["frijol"]);
  });

  test("only an equal name is exact; partial matches need confirmation; ties are ambiguous", () => {
    const records = [{ name: "Carlos Rivas" }, { name: "Carlos Méndez" }, { name: "Ana Guzmán" }];
    expect(matchName("Ana Guzman", records)).toMatchObject({ kind: "matched", exact: true });
    expect(matchName("doña Ana", records)).toMatchObject({ kind: "matched", exact: false });
    expect(matchName("don Carlos", records)).toEqual({ kind: "ambiguous" });
    expect(matchName("Pedro", records)).toEqual({ kind: "none" });
    expect(matchName(null, records)).toEqual({ kind: "none" });
    expect(matchName("don", records)).toEqual({ kind: "none" });
    expect(matchName("cafés", [{ name: "Café" }])).toMatchObject({ kind: "matched", exact: true });
    expect(matchName("frijoles", [{ name: "Frijol rojo 1 lb" }])).toMatchObject({
      kind: "matched",
      exact: false,
    });
  });

  test("fragments are found as whole words regardless of case, accents and spacing", () => {
    const sentence = "Le vendí  CAFÉ a Café Rico y cafetería";
    expect(findOccurrences(sentence, "cafe")).toEqual([
      [10, 14],
      [17, 21],
    ]);
    expect(findOccurrences(sentence, "vendi cafe")).toEqual([[3, 14]]);
    expect(findOccurrences(sentence, "té")).toEqual([]);
  });
});

describe("extraction schema", () => {
  test("the JSON schema sent to the model requires every field the validator reads", () => {
    expect(new Set<string>(extractionJsonSchema.required)).toEqual(
      new Set<string>(Object.keys(extractionSchema.shape)),
    );
  });
});
