import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { Debtors, MoneyTrend, MovementList } from "@pisto/contracts";
import {
  type DebtorsRepository,
  type MoneyTrendRepository,
  type MovementsRepository,
  ProductError,
} from "@pisto/db";
import { debtorsRoutes } from "../src/routes/debtors.ts";
import { moneyTrendRoutes } from "../src/routes/money-trend.ts";
import { movementsRoutes } from "../src/routes/movements.ts";
import { testAccess, testClient, testErrorBoundary } from "./http-client.ts";

const trend: MoneyTrend = {
  range: "7d",
  startLocalDate: "2026-10-27",
  endLocalDate: "2026-11-02",
  timeZone: "America/El_Salvador",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  activeAccountCount: "1",
  openingMinorUnits: "1000",
  closingMinorUnits: "1500",
  changeMinorUnits: "500",
  points: [{ localDate: "2026-11-02", closingMinorUnits: "1500" }],
  kinds: [{ kind: "cash", accountCount: "1", balanceMinorUnits: "1500" }],
  queriedAt: "2026-11-02T18:00:00.000Z",
};

const movements: MovementList = {
  items: [],
  nextCursor: null,
  totals: { inflowMinorUnits: "0", outflowMinorUnits: "0", netMinorUnits: "0" },
  days: [],
  period: {
    startLocalDate: "2026-10-01",
    endLocalDate: "2026-10-31",
    timeZone: "America/El_Salvador",
  },
  currency: "USD",
  currencyMinorUnitDigits: 2,
  queriedAt: "2026-11-02T18:00:00.000Z",
};

const debtors: Debtors = {
  items: [],
  customerCount: "0",
  businessLocalDate: "2026-11-02",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  queriedAt: "2026-11-02T18:00:00.000Z",
};

const actor = {
  userId: "user_test",
  sessionId: "session_test",
  activeBusinessId: "business_test",
};

function auth(authenticated: boolean) {
  return {
    api: {
      getSession: async () =>
        authenticated
          ? {
              user: { id: actor.userId },
              session: {
                id: actor.sessionId,
                activeOrganizationId: actor.activeBusinessId,
                expiresAt: new Date(Date.now() + 60_000),
              },
            }
          : null,
    },
  } as unknown as Auth;
}

function app(
  repositories: {
    getMoneyTrend?: MoneyTrendRepository["getMoneyTrend"];
    listMovements?: MovementsRepository["listMovements"];
    getDebtors?: DebtorsRepository["getDebtors"];
  },
  authenticated = true,
) {
  const access = testAccess(auth(authenticated));
  const unexpected = () => {
    throw new Error("Unexpected repository call");
  };
  return testClient(
    testErrorBoundary()
      .use(
        moneyTrendRoutes({
          access,
          moneyTrend: { getMoneyTrend: repositories.getMoneyTrend ?? unexpected },
        }),
      )
      .use(
        movementsRoutes({
          access,
          movements: { listMovements: repositories.listMovements ?? unexpected },
        }),
      )
      .use(
        debtorsRoutes({ access, debtors: { getDebtors: repositories.getDebtors ?? unexpected } }),
      ),
  );
}

const validMovements = "startLocalDate=2026-10-01&endLocalDate=2026-10-31";

describe("money trend route", () => {
  test("requires authentication before the repository runs", async () => {
    let called = false;
    const response = await app(
      {
        getMoneyTrend: async () => {
          called = true;
          return trend;
        },
      },
      false,
    ).request("/v1/reports/money-trend?range=7d");
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("defaults the range and passes a server-derived actor", async () => {
    let received: unknown;
    const response = await app({
      getMoneyTrend: async (receivedActor, query) => {
        received = { actor: receivedActor, query };
        return trend;
      },
    }).request("/v1/reports/money-trend");
    expect(response.status).toBe(200);
    expect(received).toEqual({ actor, query: { range: "30d" } });
    expect(await response.json()).toEqual({ data: { trend } });
  });

  test.each(["range=1y", "range=7d&businessId=other", "range=7d&range=30d"])(
    "rejects %s without calling the repository",
    async (query) => {
      let called = false;
      const response = await app({
        getMoneyTrend: async () => {
          called = true;
          return trend;
        },
      }).request(`/v1/reports/money-trend?${query}`);
      expect(response.status).toBe(400);
      expect(called).toBe(false);
    },
  );

  test("maps a missing cash permission to 403", async () => {
    const response = await app({
      getMoneyTrend: async () => {
        throw new ProductError("FORBIDDEN", "Cash read permission is required");
      },
    }).request("/v1/reports/money-trend?range=6m");
    expect(response.status).toBe(403);
  });
});

describe("movements route", () => {
  test("passes the parsed filters with defaults", async () => {
    let received: unknown;
    const response = await app({
      listMovements: async (receivedActor, query) => {
        received = { actor: receivedActor, query };
        return movements;
      },
    }).request(`/v1/movements?${validMovements}&kind=expense&query=luz`);
    expect(response.status).toBe(200);
    expect(received).toEqual({
      actor,
      query: {
        startLocalDate: "2026-10-01",
        endLocalDate: "2026-10-31",
        kind: "expense",
        query: "luz",
        limit: 25,
      },
    });
    expect(await response.json()).toEqual({ data: movements });
  });

  test.each([
    "",
    "startLocalDate=2026-10-31&endLocalDate=2026-10-01",
    "startLocalDate=2025-01-01&endLocalDate=2026-01-02",
    `${validMovements}&kind=transfer`,
    `${validMovements}&accountId=not-a-uuid`,
    `${validMovements}&businessId=other`,
  ])("rejects an invalid filter set: %s", async (query) => {
    let called = false;
    const response = await app({
      listMovements: async () => {
        called = true;
        return movements;
      },
    }).request(`/v1/movements?${query}`);
    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });
});

describe("debtors route", () => {
  test("requires authentication and returns the repository result", async () => {
    let calls = 0;
    const getDebtors = async () => {
      calls += 1;
      return debtors;
    };
    expect((await app({ getDebtors }, false).request("/v1/receivables/debtors")).status).toBe(401);
    expect(calls).toBe(0);
    const response = await app({ getDebtors }).request("/v1/receivables/debtors");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { debtors } });
  });
});
