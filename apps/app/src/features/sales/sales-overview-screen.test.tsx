import type { BusinessPermission, Sale } from "@pisto/contracts";
import { skipToken } from "@tanstack/react-query";
import { cloneElement, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

type QueryOptions = { queryFn: unknown; queryKey: readonly unknown[] };

const fixture = vi.hoisted(() => ({
  params: {} as Record<string, string | string[] | undefined>,
  router: { push: vi.fn(), setParams: vi.fn() },
  permissions: [] as BusinessPermission[],
  queries: [] as QueryOptions[],
  filterBar: undefined as undefined | { onChange: (value: string) => void; value: string },
}));

const queriedAt = "2026-10-04T18:00:00.000Z";
const sale: Sale = {
  id: "sale-a",
  status: "posted",
  entryMode: "total_only",
  grossMinorUnits: "1250",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: queriedAt,
  occurredLocalDate: "2026-10-04",
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  description: "Counter order",
  correction: null,
  createdAt: queriedAt,
};

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  const settled = (data: unknown) => ({
    data,
    error: null,
    fetchStatus: "idle",
    isError: false,
    isFetching: false,
    isPending: data === undefined,
    refetch: vi.fn(),
  });
  return {
    ...actual,
    useQuery: (options: QueryOptions) => {
      fixture.queries.push(options);
      if (options.queryKey[0] === "businesses") {
        return settled({
          activeBusinessId: "business",
          items: [
            {
              id: "business",
              name: "Tienda Luna",
              currency: "USD",
              currencyMinorUnitDigits: 2,
              timeZone: "America/El_Salvador",
              createdAt: queriedAt,
              access: { role: "owner", permissions: fixture.permissions },
            },
          ],
        });
      }
      if (options.queryFn === actual.skipToken) return settled(undefined);
      return settled({
        summary: {
          periodStartLocal: "2026-09-01",
          periodEndLocalExclusive: "2026-10-01",
          periodStartUtc: "2026-09-01T06:00:00.000Z",
          periodEndUtcExclusive: "2026-10-01T06:00:00.000Z",
          timeZone: "America/El_Salvador",
          currency: "USD",
          currencyMinorUnitDigits: 2,
          grossMinorUnits: "123450",
          saleCount: "18",
          averageMinorUnits: "6858",
          queriedAt,
        },
      });
    },
    useInfiniteQuery: (options: QueryOptions) => {
      fixture.queries.push(options);
      return {
        ...settled({
          pageParams: [undefined],
          pages: [{ items: [sale], nextCursor: null, queriedAt }],
        }),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
      };
    },
  };
});
vi.mock("expo-router", () => ({
  Link: ({ children, href }: { children: ReactElement<Record<string, unknown>>; href: unknown }) =>
    cloneElement(children, {
      accessibilityRole: "link",
      href: typeof href === "string" ? href : JSON.stringify(href),
    }),
  Redirect: () => null,
  useLocalSearchParams: () => fixture.params,
  useRouter: () => fixture.router,
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#1c1917") : "#1c1917",
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("@/components/ui/filter-bar", () => ({
  FilterBar: (props: { onChange: (value: string) => void; value: string }) => {
    fixture.filterBar = props;
    return null;
  },
}));
vi.mock("@/lib/api-client", () => ({
  api: { businesses: { list: vi.fn() }, sales: { list: vi.fn(), previousMonthSummary: vi.fn() } },
}));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

import SalesOverviewScreen from "./sales-overview-screen";

const everything: BusinessPermission[] = [
  "sales:read",
  "sales:summary:read",
  "sales:create",
  "sales:correct",
];

function render() {
  fixture.queries = [];
  return renderToStaticMarkup(createElement(SalesOverviewScreen));
}

function historyKey() {
  const history = fixture.queries.find(({ queryKey }) => queryKey.includes("list"));
  if (!history) throw new Error("The history was not queried");
  return history.queryKey;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.params = {};
  fixture.permissions = everything;
  fixture.filterBar = undefined;
});

describe("sales overview", () => {
  test("offers registering a sale only to a role that can create one", () => {
    expect(render()).toContain('href="/operate/sales/new"');
    fixture.permissions = ["sales:read", "sales:summary:read"];
    const readOnly = render();
    expect(readOnly).not.toContain('href="/operate/sales/new"');
    expect(readOnly).toContain("Counter order");
  });

  test("restores the status filter from the URL and writes a change back to it", () => {
    fixture.params = { status: "voided" };
    render();
    expect(historyKey()).toEqual(["sales", "business", "list", "voided"]);
    expect(fixture.filterBar?.value).toBe("voided");
    fixture.filterBar?.onChange("posted");
    expect(fixture.router.setParams).toHaveBeenLastCalledWith({ status: "posted" });
    fixture.filterBar?.onChange("all");
    expect(fixture.router.setParams).toHaveBeenLastCalledWith({ status: undefined });
  });

  test("reads every sale when the URL carries no or an unknown status", () => {
    render();
    expect(historyKey()).toEqual(["sales", "business", "list", "all"]);
    fixture.params = { status: "deleted" };
    render();
    expect(historyKey()).toEqual(["sales", "business", "list", "all"]);
    expect(fixture.filterBar?.value).toBe("all");
  });

  test("labels the summary as the previous month and skips it without its permission", () => {
    const markup = render();
    expect(markup).toContain("sales.summary.title");
    expect(markup).toContain("$1,234.50");
    expect(markup).toContain("$68.58");
    fixture.permissions = ["sales:read"];
    const withoutSummary = render();
    const summary = fixture.queries.find(({ queryKey }) => queryKey.includes("summary"));
    expect(summary?.queryFn).toBe(skipToken);
    expect(withoutSummary).not.toContain("sales.summary.gross");
  });
});
