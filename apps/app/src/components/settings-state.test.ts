import { cloneElement, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

type Read = Record<string, unknown>;

const fixture = vi.hoisted(() => ({
  businesses: {} as Record<string, unknown>,
  profile: {} as Record<string, unknown>,
  signOut: { error: undefined as string | undefined, isPending: false, signOut: () => undefined },
}));
vi.mock("@/components/appearance-control", () => ({ AppearanceControl: () => null }));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { queryKey: readonly unknown[] }) =>
    options.queryKey[0] === "businesses" ? fixture.businesses : fixture.profile,
}));
vi.mock("expo-router", () => ({
  Link: ({ children, href }: { children: ReactElement<Record<string, unknown>>; href: string }) =>
    cloneElement(children, { href }),
}));
vi.mock("@/lib/api-client", () => ({ api: { businesses: { list: vi.fn() }, me: vi.fn() } }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/hooks/use-sign-out", () => ({ useSignOut: () => fixture.signOut }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#525252") : "#525252",
  Uniwind: { setTheme: vi.fn() },
  useUniwind: () => ({ theme: "light", hasAdaptiveThemes: false }),
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import SettingsScreen from "@/app/(app)/settings";
import { i18n } from "@/i18n/config";

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

const business = {
  id: "business-a",
  name: "Tienda Luna",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  timeZone: "America/El_Salvador",
  createdAt: "2026-09-01T12:00:00.000Z",
  access: { role: "owner", permissions: [] },
};

function render() {
  return renderToStaticMarkup(createElement(SettingsScreen));
}

beforeEach(() => {
  fixture.profile = settled({
    user: { name: "Current profile", email: "private@example.test", emailVerified: true },
    session: { expiresAt: "2099-01-01T00:00:00Z" },
  });
  fixture.businesses = settled({ activeBusinessId: business.id, items: [business] });
  fixture.signOut = { error: undefined, isPending: false, signOut: () => undefined };
});

describe("profile read truth", () => {
  test("shows verified data only after a successful profile read", () => {
    const markup = render();
    expect(markup).toContain("private@example.test");
    expect(markup).toContain(i18n.t("settings.verifiedEmail"));
    expect(markup).toContain(i18n.t("settings.active"));
  });

  test.each(["error", "paused", "missing"])(
    "does not substitute cached authentication for an unavailable %s profile",
    (state) => {
      if (state === "error") fixture.profile.isError = true;
      if (state === "paused") fixture.profile.fetchStatus = "paused";
      if (state === "missing") fixture.profile.data = undefined;
      const markup = render();
      expect(markup).not.toContain("private@example.test");
      expect(markup).not.toContain(i18n.t("settings.verifiedEmail"));
      expect(markup).not.toContain(i18n.t("settings.unverifiedEmail"));
      expect(markup).toContain(i18n.t("settings.unconfirmed"));
      expect(markup).toContain(i18n.t("settings.profileUnavailable"));
    },
  );

  test("distinguishes pending verification from an unverified email", () => {
    fixture.profile.data = undefined;
    fixture.profile.isPending = true;
    const markup = render();
    expect(markup).toContain(i18n.t("settings.loadingAccount"));
    expect(markup).toContain(i18n.t("settings.checking"));
    expect(markup).not.toContain(i18n.t("settings.unverifiedEmail"));
  });
});

describe("active business facts", () => {
  test("states the business the account works in without raw identifiers", () => {
    const markup = render();
    expect(markup).toContain("Tienda Luna");
    expect(markup).toContain("Dólar estadounidense (USD)");
    expect(markup).toContain("El Salvador (GMT-6)");
    expect(markup).not.toContain("America/El_Salvador");
    expect(markup).toContain(i18n.t("settings.roles.owner"));
    expect(markup).not.toContain("business-a");
    expect(markup).not.toContain(i18n.t("settings.businessSwitchHint"));
  });

  test("hides a cached business once the read is rejected", () => {
    Object.assign(fixture.businesses, {
      error: new ApiClientError("Session expired", 401, "UNAUTHORIZED"),
      isError: true,
    });
    const markup = render();
    expect(markup).not.toContain("Tienda Luna");
    expect(markup).toContain(i18n.t("settings.businessUnavailable"));
  });

  test("offers business setup only when no business is active", () => {
    fixture.businesses = settled({ activeBusinessId: null, items: [business] });
    const markup = render();
    expect(markup).toContain(i18n.t("settings.noBusiness"));
    expect(markup).toContain('href="/business"');
    expect(markup).not.toContain("Tienda Luna");
  });
});

describe("sign-out", () => {
  test("keeps its name while pending and reports a failure", () => {
    fixture.signOut = {
      error: "No pudimos cerrar sesión",
      isPending: true,
      signOut: () => undefined,
    };
    const markup = render();
    expect(markup).toContain(i18n.t("common.signOut"));
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("No pudimos cerrar sesión");
  });
});
