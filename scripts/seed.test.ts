import { describe, expect, test } from "bun:test";

import { demoUsers, localDate, seedPassword } from "./seed.ts";

describe("seed", () => {
  test("derives El Salvador business dates from UTC", () => {
    const lateEvening = new Date("2026-11-02T03:30:00.000Z");
    expect(localDate(lateEvening, 0)).toBe("2026-11-01");
    expect(localDate(lateEvening, 7)).toBe("2026-10-25");
  });

  test("uses the documented demo password unless a valid one is configured", () => {
    expect(seedPassword({})).toBe("PistoDemo2026");
    expect(seedPassword({ SEED_PASSWORD: "another-strong-one" })).toBe("another-strong-one");
    expect(() => seedPassword({ SEED_PASSWORD: "short" })).toThrow("at least 8");
  });

  test("covers each preconfigured role once with a reserved test domain", () => {
    expect(demoUsers.map(({ role }) => role)).toEqual(["owner", "admin", "member"]);
    for (const { email } of demoUsers) expect(email.endsWith("@pisto.test")).toBe(true);
  });
});
