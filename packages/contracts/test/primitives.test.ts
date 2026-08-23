import { describe, expect, test } from "bun:test";

import {
  boundedListLimitSchema,
  calendarLocalDateSchema,
  localDateSchema,
  minorUnitsSchema,
  opaqueCursorSchema,
  pageCursorSchema,
  pageLimitSchema,
  positiveMinorUnitsSchema,
  timestampSchema,
  uuidSchema,
} from "../src/index.ts";

describe("calendar-valid local dates", () => {
  test.each(["2026-01-01", "2024-02-29", "2026-02-28", "2026-04-30", "2026-12-31", "2000-02-29"])(
    "accepts the real calendar date %s",
    (value) => {
      expect(calendarLocalDateSchema.safeParse(value).success).toBe(true);
    },
  );

  test.each([
    "2026-02-30",
    "2025-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-11-31",
  ])("rejects the impossible calendar date %s", (value) => {
    expect(calendarLocalDateSchema.safeParse(value).success).toBe(false);
  });

  test.each(["2026-1-1", "26-01-01", "2026/01/01", "2026-01-01T00:00:00Z", ""])(
    "rejects the malformed date %s",
    (value) => {
      expect(calendarLocalDateSchema.safeParse(value).success).toBe(false);
    },
  );

  test("leaves the format-only local date primitive unchanged", () => {
    expect(localDateSchema.safeParse("2026-02-30").success).toBe(true);
    expect(localDateSchema.safeParse("2025-02-29").success).toBe(true);
    expect(localDateSchema.safeParse("2026-1-1").success).toBe(false);
  });
});

describe("shared primitive behaviour", () => {
  test("uuid rejects a non-uuid identifier", () => {
    expect(uuidSchema.safeParse("6b2f0a4c-6c5b-4c9a-9c2f-1f0b5d0f9a11").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  test("timestamp requires an explicit offset or Z", () => {
    expect(timestampSchema.safeParse("2026-08-22T18:00:00.000Z").success).toBe(true);
    expect(timestampSchema.safeParse("2026-08-22T18:00:00+02:00").success).toBe(true);
    expect(timestampSchema.safeParse("2026-08-22T18:00:00").success).toBe(false);
  });

  test("minor units stay inside the signed 64-bit range", () => {
    expect(minorUnitsSchema.safeParse("0").success).toBe(true);
    expect(minorUnitsSchema.safeParse("9223372036854775807").success).toBe(true);
    expect(minorUnitsSchema.safeParse("9223372036854775808").success).toBe(false);
    expect(minorUnitsSchema.safeParse("-1").success).toBe(false);
    expect(positiveMinorUnitsSchema.safeParse("0").success).toBe(false);
    expect(positiveMinorUnitsSchema.safeParse("1").success).toBe(true);
  });

  test("bounded list limit coerces, defaults, and clamps", () => {
    expect(boundedListLimitSchema.parse(undefined)).toBe(25);
    expect(boundedListLimitSchema.parse("10")).toBe(10);
    expect(boundedListLimitSchema.safeParse(0).success).toBe(false);
    expect(boundedListLimitSchema.safeParse(51).success).toBe(false);
    expect(boundedListLimitSchema.safeParse(1.5).success).toBe(false);
  });

  test("opaque cursor keeps its length bounds", () => {
    expect(opaqueCursorSchema.safeParse("").success).toBe(false);
    expect(opaqueCursorSchema.safeParse("a".repeat(512)).success).toBe(true);
    expect(opaqueCursorSchema.safeParse("a".repeat(513)).success).toBe(false);
  });
});

describe("receivables paging aliases keep their published behaviour", () => {
  test("cursor bounds are unchanged", () => {
    expect(pageCursorSchema.safeParse("").success).toBe(false);
    expect(pageCursorSchema.safeParse("a".repeat(512)).success).toBe(true);
    expect(pageCursorSchema.safeParse("a".repeat(513)).success).toBe(false);
  });

  test("limit coercion and default are unchanged", () => {
    expect(pageLimitSchema.parse(undefined)).toBe(25);
    expect(pageLimitSchema.parse("50")).toBe(50);
    expect(pageLimitSchema.safeParse(51).success).toBe(false);
  });
});
