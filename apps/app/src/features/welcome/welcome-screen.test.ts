import { Children, cloneElement, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("react-native-safe-area-context", async () => ({
  SafeAreaView: (
    await vi.importActual<{ View: typeof import("react-native").View }>("react-native-web")
  ).View,
}));
vi.mock("expo-router", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) =>
    cloneElement(Children.only(children) as ReactElement<Record<string, unknown>>, {
      href,
      accessibilityRole: "link",
    }),
}));
vi.mock("expo-router/head", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@/providers/appearance-provider", () => ({
  useAppearance: () => ({ choice: "system", pending: false, issue: null, select: vi.fn() }),
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({ Laptop: () => null, Moon: () => null, Sun: () => null }));

import { OPERATE_MODULES } from "@/features/operate/navigation";
import { i18n } from "@/i18n/config";
import WelcomeScreen from "./welcome-screen";

describe("public product page", () => {
  test("describes every implemented module and preserves real account destinations", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    for (const module of OPERATE_MODULES) expect(markup).toContain(i18n.t(module.labelKey));
    expect(markup).toContain('href="/sign-in"');
    expect(markup).toContain('href="/sign-up"');
    expect(markup).not.toContain('href="/operate');
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain('role="main"');
    expect(markup).toContain(i18n.t("welcome.pageTitle"));
  });

  test("labels the example and states current product limits", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    expect(markup).toContain(i18n.t("welcome.preview.label"));
    expect(markup).toContain(i18n.t("welcome.preview.note"));
    for (const question of ["sales", "accounting", "assistant", "devices"] as const) {
      expect(markup).toContain(i18n.t(`welcome.questions.${question}.answer`));
    }
  });

  test("exposes translated light, dark and system controls before signing in", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    for (const choice of ["light", "dark", "system"] as const) {
      expect(markup).toContain(`aria-label="${i18n.t(`settings.themes.${choice}`)}"`);
    }
    expect(markup).toContain('aria-pressed="true"');
  });
});
