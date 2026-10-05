import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

type Read = Record<string, unknown>;

const fixture = vi.hoisted(() => ({
  capabilities: { canManage: true, canPurchase: true, channel: "web-checkout" as string },
  catalog: {} as Record<string, unknown>,
  catalogEnabled: [] as unknown[],
  entitlements: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useMutation: () => ({ isPending: false, mutate: vi.fn(), variables: undefined }),
  useQuery: (options: { enabled?: boolean; queryKey: readonly unknown[] }) => {
    if (options.queryKey[1] === "catalog") {
      fixture.catalogEnabled.push(options.enabled);
      return fixture.catalog;
    }
    return fixture.entitlements;
  },
}));
vi.mock("@/lib/billing/platform-billing", () => ({
  platformBilling: {
    get capabilities() {
      return fixture.capabilities;
    },
    manage: vi.fn(),
    purchase: vi.fn(),
  },
}));
vi.mock("@/lib/api-client", () => ({
  api: { billing: { catalog: vi.fn(), entitlements: vi.fn() } },
}));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), warning: vi.fn() } }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#1c1917") : "#1c1917",
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import BillingScreen from "@/app/(app)/billing";
import { i18n } from "@/i18n/config";

const t = i18n.t;

function settled(data: unknown): Read {
  return {
    data,
    error: null,
    fetchStatus: "idle",
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: vi.fn(),
  };
}

const grant = {
  key: "pro",
  status: "active",
  source: "polar",
  productId: "provider-product",
  validFrom: null,
  validUntil: null,
  metadata: {},
};

function render() {
  fixture.catalogEnabled = [];
  return renderToStaticMarkup(createElement(BillingScreen));
}

beforeEach(() => {
  fixture.capabilities = { canManage: true, canPurchase: true, channel: "web-checkout" };
  fixture.catalog = settled({ status: "disabled", provider: null, products: [] });
  fixture.entitlements = settled({ scope: { type: "organization", id: "org-a" }, items: [] });
});

describe("billing screen truth", () => {
  test("says payments are not available yet and offers no plan, price or checkout", () => {
    const markup = render();
    expect(markup).toContain(t("billing.plans.disabledTitle"));
    expect(markup).toContain(t("billing.access.none"));
    expect(markup).toContain(t("billing.access.scopes.organization"));
    expect(markup).not.toContain(t("billing.plans.checkout"));
    expect(markup).not.toContain(t("billing.manage"));
    expect(markup).not.toMatch(/\$\d/);
  });

  test("offers checkout and the portal only for an enabled catalog on the web", () => {
    fixture.catalog = settled({
      status: "enabled",
      provider: "polar",
      products: [{ slug: "pisto-plus-monthly", name: "Pisto Plus", description: "Plan mensual" }],
    });
    const markup = render();
    expect(markup).toContain("Pisto Plus");
    expect(markup).toContain("Plan mensual");
    expect(markup).toContain(t("billing.plans.checkout"));
    expect(markup).toContain(t("billing.manage"));
  });

  test("never reads or sells the web catalog from a native build", () => {
    fixture.capabilities = {
      canManage: false,
      canPurchase: false,
      channel: "native-store-placeholder",
    };
    fixture.catalog = settled({
      status: "enabled",
      provider: "polar",
      products: [{ slug: "pisto-plus-monthly", name: "Pisto Plus" }],
    });
    const markup = render();
    expect(fixture.catalogEnabled).toEqual([false]);
    expect(markup).toContain(t("billing.plans.notOfferedTitle"));
    expect(markup).not.toContain("Pisto Plus");
    expect(markup).not.toContain(t("billing.manage"));
  });

  test("does not assume standard or active access when the entitlement read fails", () => {
    fixture.entitlements = { ...settled(undefined), error: new Error("down"), isError: true };
    const markup = render();
    expect(markup).toContain(t("billing.access.unavailableTitle"));
    expect(markup).not.toContain(t("billing.access.none"));
    expect(markup).not.toContain(t("billing.access.active"));
  });

  test("lists active grants exactly as the API returns them without provider identifiers", () => {
    fixture.entitlements = settled({
      scope: { type: "user", id: "user-a" },
      items: [grant, { ...grant, source: "revenuecat", validUntil: "2026-11-04T18:00:00.000Z" }],
    });
    const markup = render();
    expect(markup).toContain(t("billing.access.scopes.user"));
    expect(markup).toContain(t("billing.access.sources.polar"));
    expect(markup).toContain(t("billing.access.sources.revenuecat"));
    expect(markup).toContain(t("billing.access.noExpiry"));
    expect(markup).toContain(t("billing.access.validUntil", { date: "4 nov 2026" }));
    expect(markup).not.toContain("provider-product");
    expect(markup).not.toContain("user-a");
  });
});
