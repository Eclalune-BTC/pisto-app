import { beforeEach, describe, expect, test, vi } from "vitest";

const http = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("axios", () => ({
  default: { create: () => http, isCancel: () => false },
}));
vi.mock("@/lib/auth-client", () => ({ authClient: { getCookie: async () => null } }));
vi.mock("@/lib/env", () => ({ env: { apiUrl: "http://localhost:3015" } }));

import { ApiClientError } from "@/lib/api-error";
import { inventoryApi } from "../inventory/api";
import { catalogApi } from "./api";

const key = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  http.request.mockReset();
  http.request.mockResolvedValue({
    status: 200,
    data: JSON.stringify({ data: { items: [], nextCursor: null } }),
  });
});

describe("catalog and inventory requests", () => {
  test("rejects an invalid command as a validation failure before any request", async () => {
    const commands = [
      () => catalogApi.categories.create({ idempotencyKey: key, name: " " }),
      () => catalogApi.products.archive("product", { idempotencyKey: "not-a-key" }),
      () =>
        inventoryApi.reverseMovement("movement", {
          idempotencyKey: key,
          occurredLocalDate: "2026-02-30",
          occurredLocalTime: "12:00",
          reason: "Counted twice",
        }),
    ];
    for (const send of commands) {
      let thrown: unknown;
      try {
        await send();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ApiClientError);
      expect(thrown).toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    }
    expect(http.request).not.toHaveBeenCalled();
  });

  test("sends only the list filters that are set", async () => {
    await catalogApi.products.list({
      categoryId: undefined,
      cursor: undefined,
      limit: 25,
      search: undefined,
      status: "archived",
    });
    expect(http.request.mock.lastCall?.[0].url).toBe(
      "/v1/catalog/products?limit=25&status=archived",
    );
    await inventoryApi.listStock({
      cursor: "next_1",
      limit: 25,
      lowStockOnly: true,
      search: "café",
    });
    expect(http.request.mock.lastCall?.[0].url).toBe(
      "/v1/inventory/stock?cursor=next_1&limit=25&lowStockOnly=true&search=caf%C3%A9",
    );
  });
});
