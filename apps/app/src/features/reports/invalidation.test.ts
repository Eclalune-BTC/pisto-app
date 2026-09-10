import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

vi.mock("../cash/api", () => ({ cashApi: {} }));
vi.mock("../customers/api", () => ({ customersApi: {} }));
vi.mock("../receivables/api", () => ({ receivablesApi: {} }));
vi.mock("./api", () => ({ reportsApi: {} }));

import { invalidateCashLedger, invalidateExpensesAndCash } from "../cash/invalidate";
import { invalidateReceivableMutation } from "../receivables/mutation-state";
import { reportsQueryKeys } from "./queries";

describe("operating report freshness after canonical changes", () => {
  test.each([
    ["cash", (client: QueryClient) => invalidateCashLedger(client, "business-a")],
    ["expenses", (client: QueryClient) => invalidateExpensesAndCash(client, "business-a")],
    [
      "receivables",
      (client: QueryClient) =>
        invalidateReceivableMutation(client, {
          businessId: "business-a",
          customerId: "customer-a",
        }),
    ],
  ] as const)(
    "invalidates all %s report ranges without touching another business",
    async (_, invalidate) => {
      const client = new QueryClient();
      const keys = ["business-a", "business-b"].flatMap((businessId) =>
        ["2026-08-01", "2026-09-01"].map((startLocalDate) =>
          reportsQueryKeys.operatingRange(businessId, {
            startLocalDate,
            endLocalDate: "2026-09-10",
          }),
        ),
      );
      for (const key of keys) client.setQueryData(key, { report: "canonical cached result" });

      await invalidate(client);

      for (const key of keys) {
        expect(client.getQueryState(key)?.isInvalidated).toBe(key[1] === "business-a");
        expect(client.getQueryData(key)).toEqual({ report: "canonical cached result" });
      }
      client.clear();
    },
  );
});
