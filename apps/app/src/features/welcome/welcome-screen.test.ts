import { Children, cloneElement, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("@/components/ui/accordion", () => import("@/components/ui/accordion.web"));
vi.mock("react-native-svg", () => ({ default: "svg", Path: "path", Rect: "rect" }));
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
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#566781") : "#566781",
}));
vi.mock("@/providers/appearance-provider", () => ({
  useAppearance: () => ({ choice: "system", pending: false, issue: null, select: vi.fn() }),
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  Laptop: () => null,
  Moon: () => null,
  Sun: () => null,
  ChevronDown: () => null,
}));

import { OPERATE_GROUPS, OPERATE_MODULES } from "@/features/operate/navigation";
import { i18n } from "@/i18n/config";
import WelcomeScreen from "./welcome-screen";

describe("public product page", () => {
  test("exposes every product area and preserves real account destinations", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    for (const group of OPERATE_GROUPS)
      expect(markup).toContain(i18n.t(`welcome.product.${group.id}.tab`));
    for (const module of OPERATE_MODULES.filter((module) => module.group === "money"))
      expect(markup).toContain(i18n.t(module.labelKey));
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('href="/sign-in"');
    expect(markup).toContain('href="/sign-up"');
    expect(markup).not.toContain('href="/operate');
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toContain('role="main"');
    expect(markup).toContain(i18n.t("welcome.pageTitle"));
  });

  test("does not simulate financial data and exposes the current-limit questions", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    expect(markup).not.toMatch(/\$\d|Ejemplo ilustrativo|Venta de mostrador|No solo tus ventas/);
    expect(i18n.t("welcome.title")).not.toContain("\n");
    for (const question of ["sales", "accounting", "assistant", "devices"] as const) {
      expect(markup).toContain(i18n.t(`welcome.questions.${question}.question`));
      expect(markup).not.toContain(i18n.t(`welcome.questions.${question}.answer`));
    }
  });

  test("labels product captures instead of representing them as live account data", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    expect(markup).toContain(i18n.t("welcome.product.captureNote"));
    expect(markup).toContain(i18n.t("welcome.product.money.imageAlt"));
    expect(markup).not.toContain("review@example.com");
  });

  test("exposes translated light, dark and system controls before signing in", () => {
    const markup = renderToStaticMarkup(createElement(WelcomeScreen));
    for (const choice of ["light", "dark", "system"] as const) {
      expect(markup).toContain(`aria-label="${i18n.t(`settings.themes.${choice}`)}"`);
    }
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain(i18n.t("appearance.switchTo.dark"));
  });
});
