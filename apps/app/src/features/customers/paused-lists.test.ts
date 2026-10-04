import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const setup = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  summary: {} as Record<string, unknown>,
  customer: {} as Record<string, unknown>,
  params: {} as Record<string, string>,
  router: { push: () => undefined, setParams: (_params: Record<string, unknown>) => undefined },
  customerFilters: [] as unknown[],
  receivableFilters: [] as unknown[],
  screen: {} as Record<string, unknown> & {
    canManage: boolean;
    state: { kind: string; stale?: boolean };
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => setup.list,
  useQuery: (options: { read?: string }) =>
    options.read === "customer" ? setup.customer : setup.summary,
  useQueries: () => [setup.customer],
}));
vi.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => setup.params,
  useRouter: () => setup.router,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("@/features/customers/access", () => ({
  capabilityBoundaryState: () => "ready",
  useCapabilityAccess: () => ({
    business: { id: "business-a" },
    canManage: true,
    canRead: true,
    isStale: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/features/customers/screen-state", () => ({ ScreenState: () => null }));
vi.mock("@/features/customers/customer-picker", () => ({ CustomerPickerDialog: () => null }));
vi.mock("@/features/customers/queries", () => ({
  customerDetailQueryOptions: () => ({ read: "customer" }),
  customersQueryOptions: (_businessId: string, filters: unknown) => {
    setup.customerFilters.push(filters);
    return {};
  },
}));
vi.mock("@/features/receivables/queries", () => ({
  receivablesQueryOptions: (_businessId: string, filters: unknown) => {
    setup.receivableFilters.push(filters);
    return {};
  },
  receivablesSummaryQueryOptions: () => ({}),
}));
vi.mock("@/features/customers/customers-screen", () => ({
  CustomersScreen: (props: typeof setup.screen) => {
    setup.screen = props;
    return null;
  },
}));
vi.mock("@/features/receivables/receivables-screen", () => ({
  ReceivablesScreen: (props: typeof setup.screen) => {
    setup.screen = props;
    return null;
  },
}));

import CustomersRoute from "@/app/(app)/operate/customers";
import ReceivablesRoute from "@/app/(app)/operate/receivables";
import { ApiClientError } from "@/lib/api-error";

const customerId = "40000000-0000-4000-8000-000000000001";

function cached(data: unknown) {
  return { data, error: null, fetchStatus: "idle", isError: false, isPending: false };
}

beforeEach(() => {
  setup.list = cached({
    pages: [{ items: [{ id: "entry-a", customerId: "customer-a" }], nextCursor: null }],
  });
  setup.summary = cached({ summary: { openMinorUnits: "500" } });
  setup.customer = cached({ customer: { id: "customer-a", name: "Cached customer" } });
  setup.params = {};
  setup.router = { push: vi.fn(), setParams: vi.fn() };
  setup.customerFilters = [];
  setup.receivableFilters = [];
});

describe("customer and receivable lists with cached reads", () => {
  test("does not present a missing customer response as a successful empty list", () => {
    setup.list = cached(undefined);
    renderToStaticMarkup(createElement(CustomersRoute));
    expect(setup.screen.state).toEqual({ kind: "error" });
  });

  test.each([CustomersRoute, ReceivablesRoute])(
    "%s keeps healthy cached results actionable",
    (Route) => {
      renderToStaticMarkup(createElement(Route));
      expect(setup.screen.state).toMatchObject({ kind: "ready", stale: false });
      expect(setup.screen.canManage).toBe(true);
    },
  );

  test.each([CustomersRoute, ReceivablesRoute])(
    "%s labels a paused cached list stale and disables management actions",
    (Route) => {
      setup.list.fetchStatus = "paused";
      renderToStaticMarkup(createElement(Route));
      expect(setup.screen.state).toMatchObject({ kind: "ready", stale: true });
      expect(setup.screen.canManage).toBe(false);
    },
  );

  test.each(["summary", "customer"] as const)(
    "marks receivables stale when their cached %s read is paused",
    (dependency) => {
      setup[dependency].fetchStatus = "paused";
      renderToStaticMarkup(createElement(ReceivablesRoute));
      expect(setup.screen.state).toMatchObject({ kind: "ready", stale: true });
      expect(setup.screen.canManage).toBe(false);
    },
  );

  test("keeps unavailable customer metadata read-only even without a cached name", () => {
    setup.customer = { ...cached(undefined), fetchStatus: "paused", isPending: true };
    renderToStaticMarkup(createElement(ReceivablesRoute));
    expect(setup.screen.state).toMatchObject({ kind: "ready", stale: true });
    expect(setup.screen.canManage).toBe(false);
  });

  test.each([CustomersRoute, ReceivablesRoute])(
    "%s hides paused cached results after a fresh forbidden response",
    (Route) => {
      setup.list.fetchStatus = "paused";
      setup.list.error = new ApiClientError("Denied", 403, "FORBIDDEN");
      setup.list.isError = true;
      renderToStaticMarkup(createElement(Route));
      expect(setup.screen.state).toEqual({ kind: "denied" });
    },
  );

  test("hides the customer list when a row's balance read is rejected", () => {
    setup.customer = {
      ...cached(undefined),
      error: new ApiClientError("Denied", 403, "FORBIDDEN"),
      isError: true,
    };
    renderToStaticMarkup(createElement(CustomersRoute));
    expect(setup.screen.state).toEqual({ kind: "denied" });
  });
});

describe("list filters kept in the URL", () => {
  test("customers restore their search and status and write changes back", () => {
    setup.params = { q: "Ana", status: "archived" };
    renderToStaticMarkup(createElement(CustomersRoute));
    expect(setup.customerFilters.at(-1)).toEqual({ query: "Ana", status: "archived" });
    expect(setup.screen).toMatchObject({ query: "Ana", search: "Ana", status: "archived" });
    (setup.screen.onStatusChange as (status: string) => void)("all");
    expect(setup.router.setParams).toHaveBeenCalledWith({ q: "Ana", status: "all" });
  });

  test("receivables restore their state and customer and clear both together", () => {
    setup.params = { customerId, state: "overdue" };
    renderToStaticMarkup(createElement(ReceivablesRoute));
    expect(setup.receivableFilters.at(-1)).toEqual({ customerId, state: "overdue" });
    expect(setup.screen.filters).toEqual({ customerId, state: "overdue" });
    (setup.screen.onStateChange as (state: string) => void)("paid");
    expect(setup.router.setParams).toHaveBeenLastCalledWith({ customerId, state: "paid" });
    (setup.screen.onClearCustomer as () => void)();
    expect(setup.router.setParams).toHaveBeenLastCalledWith({
      customerId: undefined,
      state: "overdue",
    });
    (setup.screen.onClearFilters as () => void)();
    expect(setup.router.setParams).toHaveBeenLastCalledWith({
      customerId: undefined,
      state: undefined,
    });
  });

  test("an unknown filter in the URL is not sent to the server", () => {
    setup.params = { customerId: "not-a-customer", state: "late" };
    renderToStaticMarkup(createElement(ReceivablesRoute));
    expect(setup.receivableFilters.at(-1)).toEqual({ customerId: undefined, state: "all" });
  });
});
