import { describe, expect, test } from "vitest";

import { validateSaleDraft } from "./sale-draft";

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
});
