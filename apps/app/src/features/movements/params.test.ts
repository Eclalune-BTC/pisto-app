import { describe, expect, test } from "vitest";

import {
  movementFilters,
  movementRangeDates,
  movementSearchParams,
  parseMovementParams,
} from "./params";

const accountId = "2a903e1a-fe22-4b26-b657-0ca5fdc8ac90";

describe("movement list parameters", () => {
  test("reads valid filters and falls back on anything else", () => {
    expect(parseMovementParams({ kind: "expense", accountId, range: "today", q: "luz" })).toEqual({
      kind: "expense",
      accountId,
      range: "today",
      query: "luz",
    });
    expect(parseMovementParams({ kind: "transfer", accountId: "caja", range: "1y" })).toEqual({
      kind: "all",
      accountId: undefined,
      range: "last7Days",
      query: "",
    });
  });

  test("keeps an unknown kind out of the request", () => {
    expect(parseMovementParams({ kind: "purchase" }).kind).toBe("purchase");
    expect(parseMovementParams({ kind: "transfer" }).kind).toBe("all");
  });

  test("omits defaults from the URL", () => {
    expect(
      movementSearchParams({ kind: "all", accountId: undefined, range: "last7Days", query: " " }),
    ).toEqual({ kind: undefined, accountId: undefined, range: undefined, q: undefined });
  });

  test("counts ranges in whole business-local days", () => {
    expect(movementRangeDates("today", "2026-03-01")).toEqual({
      startLocalDate: "2026-03-01",
      endLocalDate: "2026-03-01",
    });
    expect(movementRangeDates("last7Days", "2026-03-01")).toEqual({
      startLocalDate: "2026-02-23",
      endLocalDate: "2026-03-01",
    });
    expect(movementRangeDates("thisMonth", "2026-03-18")).toEqual({
      startLocalDate: "2026-03-01",
      endLocalDate: "2026-03-18",
    });
    expect(movementRangeDates("last30Days", "2026-03-01").startLocalDate).toBe("2026-01-31");
  });

  test("sends a trimmed search and no empty one", () => {
    const params = { kind: "sale", accountId: undefined, range: "today", query: "" } as const;
    expect(movementFilters(params, "2026-11-02", "  café ").query).toBe("café");
    expect(movementFilters(params, "2026-11-02", "   ").query).toBeUndefined();
  });
});
