import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const setup = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  summary: {} as Record<string, unknown>,
  customer: {} as Record<string, unknown>,
  screen: {} as { canManage: boolean; state: { kind: string; stale?: boolean } },
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => setup.list,
  useQuery: () => setup.summary,
  useQueries: () => [setup.customer],
}));
vi.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ push: vi.fn() }),
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
vi.mock("@/features/customers/capability-boundary", () => ({
  CapabilityBoundary: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/features/customers/queries", () => ({
  customerDetailQueryOptions: () => ({}),
  customersQueryOptions: () => ({}),
}));
vi.mock("@/features/receivables/queries", () => ({
  receivablesQueryOptions: () => ({}),
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

function cached(data: unknown) {
  return { data, error: null, fetchStatus: "idle", isError: false, isPending: false };
}

beforeEach(() => {
  setup.list = cached({
    pages: [{ items: [{ id: "entry-a", customerId: "customer-a" }], nextCursor: null }],
  });
  setup.summary = cached({ summary: { openMinorUnits: "500" } });
  setup.customer = cached({ customer: { id: "customer-a", name: "Cached customer" } });
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
});
