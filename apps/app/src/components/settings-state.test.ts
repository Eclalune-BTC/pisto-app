import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ profile: {} as Record<string, unknown> }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => fixture.profile }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({ api: { me: vi.fn() } }));
vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({ isPending: false, signOut: vi.fn() }),
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  Uniwind: { setTheme: vi.fn() },
  useUniwind: () => ({ theme: "light", hasAdaptiveThemes: false }),
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  CreditCard: () => null,
  Laptop: () => null,
  LockKeyhole: () => null,
  LogOut: () => null,
  Moon: () => null,
  ShieldCheck: () => null,
  Sun: () => null,
}));

import SettingsScreen from "@/app/(app)/settings";
import { i18n } from "@/i18n/config";

beforeEach(() => {
  fixture.profile = {
    data: {
      user: { name: "Current profile", email: "private@example.test", emailVerified: true },
      session: { expiresAt: "2099-01-01T00:00:00Z" },
    },
    isPending: false,
    isFetching: false,
    isError: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
  };
});

describe("profile read truth", () => {
  test("shows verified data only after a successful profile read", () => {
    const markup = renderToStaticMarkup(createElement(SettingsScreen));
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
      const markup = renderToStaticMarkup(createElement(SettingsScreen));
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
    const markup = renderToStaticMarkup(createElement(SettingsScreen));
    expect(markup).toContain(i18n.t("settings.loadingAccount"));
    expect(markup).not.toContain(i18n.t("settings.unverifiedEmail"));
  });
});
