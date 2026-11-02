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

import { i18n } from "@/i18n/config";
import { exampleSpans } from "./dictation-example";
import WelcomeScreen, { RECORD_ITEMS } from "./welcome-screen";

const render = () => renderToStaticMarkup(createElement(WelcomeScreen));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "");

describe("public product page", () => {
  test("states the job once and keeps the real account destinations", () => {
    const markup = render();
    expect(markup.match(/aria-level="1"/g)).toHaveLength(1);
    expect(markup).toContain(i18n.t("welcome.title"));
    expect(markup).toContain('href="/sign-in"');
    expect(markup).toContain('href="/sign-up"');
    expect(markup).not.toContain('href="/operate');
    expect(markup).toContain('role="main"');
    expect(markup).toContain(i18n.t("welcome.pageTitle"));
  });

  test("describes every record it keeps and the scope it leaves out", () => {
    const markup = render();
    for (const item of RECORD_ITEMS) {
      expect(markup).toContain(i18n.t(`welcome.records.items.${item}.title`));
    }
    expect(text(markup)).toContain(i18n.t("welcome.scope.description"));
    expect(markup).not.toMatch(/role="tablist"|01<|02<|03</);
  });

  test("labels the dictation example and marks every fragment it fills", () => {
    const markup = render();
    expect(markup).toContain(`aria-label="${i18n.t("welcome.example.label")}"`);
    expect(markup).toContain(i18n.t("welcome.example.unsaved"));
    expect(text(markup)).toContain(i18n.t("welcome.example.rows.credit.value"));
    const said = i18n.t("welcome.example.said");
    const spans = exampleSpans(said, [
      i18n.t("welcome.example.fragments.kind"),
      i18n.t("welcome.example.fragments.customer"),
      i18n.t("welcome.example.fragments.product"),
      i18n.t("welcome.example.fragments.received"),
      i18n.t("welcome.example.fragments.credit"),
    ]);
    expect(spans.map((span) => said.slice(span.start, span.end))).toEqual([
      "vendí",
      "don Carlos",
      "tres libras de café",
      "cinco dólares",
      "el resto me lo quedó debiendo",
    ]);
    expect(() => exampleSpans(said, ["café", "vendí"])).toThrow();
  });

  test("exposes translated light, dark and system controls before signing in", () => {
    const markup = render();
    for (const choice of ["light", "dark", "system"] as const) {
      expect(markup).toContain(`aria-label="${i18n.t(`settings.themes.${choice}`)}"`);
    }
    expect(markup).toContain('aria-pressed="true"');
  });
});
