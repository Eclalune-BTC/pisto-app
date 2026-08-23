import { describe, expect, test } from "vitest";

import { buildBusinessCommand } from "./business-draft";

describe("business draft", () => {
  test("normalizes the user-selected currency and business settings once", () => {
    expect(
      buildBusinessCommand({
        currency: " jpy ",
        name: "  Taller Luna  ",
        timeZone: " Asia/Tokyo ",
      }),
    ).toEqual({
      ok: true,
      command: {
        currency: "JPY",
        name: "Taller Luna",
        timeZone: "Asia/Tokyo",
      },
    });
  });

  test("returns field ownership instead of localized validation copy", () => {
    expect(buildBusinessCommand({ currency: "US", name: "x", timeZone: "Mars/Olympus" })).toEqual({
      ok: false,
      fields: ["name", "currency", "timeZone"],
    });
  });
});
