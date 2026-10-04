import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";

import { saleDraftErrors, validateSaleDraft } from "./sale-draft";

const t = ((key: string, options?: { count?: number }) =>
  options?.count === undefined ? key : `${key}:${options.count}`) as TFunction;

describe("sale draft validation", () => {
  test("creates one canonical minor-unit draft", () => {
    expect(
      validateSaleDraft(
        {
          amount: "12.50",
          date: "2026-08-22",
          time: "14:30",
          description: "  Counter sale  ",
        },
        2,
      ),
    ).toEqual({
      draft: {
        grossMinorUnits: "1250",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "14:30",
        description: "Counter sale",
      },
      issues: {},
    });
  });

  test("reports money and wall-clock fields without producing a partial draft", () => {
    const result = validateSaleDraft(
      { amount: "1.234", date: "2026-02-30", time: "25:00", description: "" },
      2,
    );

    expect(result.draft).toBeNull();
    expect(result.issues).toEqual({
      amount: "invalid-decimals",
      date: "invalid-date",
      time: "invalid-time",
    });
  });

  test("tells a missing total apart from a malformed one", () => {
    const blank = validateSaleDraft(
      { amount: "  ", date: "2026-08-22", time: "14:30", description: "" },
      2,
    );
    expect(blank).toEqual({ draft: null, issues: { amount: "missing-amount" } });
    const zero = validateSaleDraft(
      { amount: "0", date: "2026-08-22", time: "14:30", description: "" },
      2,
    );
    expect(zero.issues).toEqual({ amount: "non-positive" });
  });

  test("tells a missing date or time apart from a malformed one", () => {
    expect(
      validateSaleDraft({ amount: "1", date: "", time: " ", description: "" }, 2).issues,
    ).toEqual({ date: "missing-date", time: "missing-time" });
    expect(saleDraftErrors({ date: "missing-date", time: "missing-time" }, 2, t)).toEqual({
      date: "sales.validation.dateRequired",
      time: "sales.validation.timeRequired",
    });
  });

  test("names every reported field with its own message and nothing else", () => {
    expect(
      saleDraftErrors(
        { amount: "invalid-decimals", time: "invalid-time", description: "description-too-long" },
        2,
        t,
      ),
    ).toEqual({
      amount: "sales.validation.amountDecimals:2",
      time: "sales.validation.time",
      description: "sales.validation.description",
    });
    expect(saleDraftErrors({ amount: "missing-amount" }, 0, t)).toEqual({
      amount: "sales.validation.amountRequired",
    });
    expect(saleDraftErrors({}, 2, t)).toEqual({});
  });
});
