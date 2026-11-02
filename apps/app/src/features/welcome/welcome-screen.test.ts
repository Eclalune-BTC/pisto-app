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
// The role matrix shares its jobs with Configuración, whose module also reads the API.
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));

import { ROLE_CAPABILITIES, roleCan } from "@/features/business/business-settings";
import { i18n } from "@/i18n/config";
import { resolveBusinessAccess } from "../../../../../packages/db/src/product-access";
import { exampleSpans } from "./dictation-example";
import {
  BEFORE_DICTATED_SALE,
  EXAMPLE_ACCOUNTS,
  EXAMPLE_AGING,
  EXAMPLE_CREDITORS,
  EXAMPLE_DEBTORS,
  EXAMPLE_MOVEMENTS,
  EXAMPLE_PAYABLES,
  EXAMPLE_RECEIVABLES,
  exampleCashFlow,
  exampleMoneyTrend,
  shiftLocalDate,
  shiftLocalMonth,
} from "./example-business";
import { STEPS } from "./how-it-works";
import { MODULES } from "./module-previews";
import { PUBLIC_ROLE_ACCESS, ROLES, TRUST_POINTS } from "./roles-section";
import WelcomeScreen from "./welcome-screen";

const render = () => renderToStaticMarkup(createElement(WelcomeScreen));
const text = (markup: string) => markup.replace(/<[^>]+>/g, "");
const sum = (values: readonly string[]) =>
  values.reduce((total, value) => total + BigInt(value), 0n);

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

  test("keeps a heading outline that never skips a level", () => {
    const levels = [...render().matchAll(/aria-level="(\d)"/g)].map(([, level]) => Number(level));
    expect(levels[0]).toBe(1);
    for (const [index, level] of levels.entries()) {
      if (index > 0) expect(level - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1);
    }
  });

  test("walks through every step, module, role and guarantee it promises", () => {
    const markup = text(render());
    for (const step of STEPS) expect(markup).toContain(i18n.t(`welcome.how.steps.${step}.title`));
    for (const module of MODULES) {
      expect(markup).toContain(i18n.t(`welcome.modules.items.${module}.title`));
    }
    for (const role of ROLES) expect(markup).toContain(i18n.t(`settings.roleNames.${role}`));
    for (const point of TRUST_POINTS) {
      expect(markup).toContain(i18n.t(`welcome.roles.trust.${point}.description`));
    }
    expect(markup).toContain(i18n.t("welcome.roles.scope.description"));
    expect(markup).not.toMatch(/Universidad|Francisco Gavidia|UFG|Proyecto de Aplicación/);
  });

  test("labels every illustration as an example and marks it as a figure", () => {
    const markup = render();
    // One figure per illustration: a figure inside another would be announced twice.
    expect(markup).toContain("<figure");
    expect(markup).not.toMatch(/<figure[^>]*>(?:(?!<\/figure>).)*<figure/s);
    expect(text(markup)).toContain(i18n.t("welcome.preview.example"));
    expect(markup).toContain(`aria-label="${i18n.t("welcome.preview.label")}"`);
    for (const step of STEPS) {
      expect(markup).toContain(`aria-label="${i18n.t(`welcome.how.steps.${step}.figure`)}"`);
    }
    for (const module of MODULES) {
      expect(markup).toContain(`aria-label="${i18n.t(`welcome.modules.items.${module}.figure`)}"`);
    }
    // Illustrated controls look like buttons but are not announced as ones: the only button on
    // the page is the appearance switch; every other action is a link.
    expect(markup.match(/role="button"/g)).toHaveLength(1);
  });

  test("labels the dictation example and marks every fragment it fills", () => {
    const markup = render();
    expect(markup).toContain(`aria-label="${i18n.t("welcome.how.steps.review.figure")}"`);
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

  test("lets a visitor switch to the dark appearance before signing in", () => {
    expect(render()).toContain(`aria-label="${i18n.t("appearance.switchTo.dark")}"`);
  });
});

describe("role summary for visitors", () => {
  test("matches the server's role policy job by job", () => {
    for (const role of ROLES) {
      const policy = resolveBusinessAccess(role);
      if (!policy) throw new Error(`No policy for ${role}`);
      for (const capability of ROLE_CAPABILITIES) {
        expect([role, capability.key, PUBLIC_ROLE_ACCESS[role].includes(capability.key)]).toEqual([
          role,
          capability.key,
          roleCan(policy, capability),
        ]);
      }
    }
  });
});

describe("example business", () => {
  const today = "2026-11-03";

  test("counts dates and months across month and year ends", () => {
    expect(shiftLocalDate("2026-11-03", -30)).toBe("2026-10-04");
    expect(shiftLocalDate("2026-12-30", 3)).toBe("2027-01-02");
    expect(shiftLocalMonth("2026-03-31", -5)).toBe("2025-10");
    expect(() => shiftLocalDate("today", 1)).toThrow();
  });

  test("draws a money trend that ends today on the accounts it lists", () => {
    const trend = exampleMoneyTrend(today);
    expect(trend.points.at(-1)).toEqual({
      localDate: today,
      closingMinorUnits: trend.closingMinorUnits,
    });
    expect(trend.startLocalDate).toBe(trend.points[0]?.localDate);
    expect(sum(Object.values(EXAMPLE_ACCOUNTS))).toBe(BigInt(trend.closingMinorUnits));
    expect(BigInt(trend.openingMinorUnits) + BigInt(trend.changeMinorUnits)).toBe(
      BigInt(trend.closingMinorUnits),
    );
  });

  test("adds up every balance it shows", () => {
    const buckets = Object.values(EXAMPLE_AGING).map((bucket) => bucket.minorUnits);
    expect(sum(buckets)).toBe(BigInt(EXAMPLE_RECEIVABLES.outstanding));
    const { current: _current, ...late } = EXAMPLE_AGING;
    expect(sum(Object.values(late).map((bucket) => bucket.minorUnits))).toBe(
      BigInt(EXAMPLE_RECEIVABLES.overdue),
    );
    expect(sum(EXAMPLE_CREDITORS.map((creditor) => creditor.minorUnits))).toBe(
      BigInt(EXAMPLE_PAYABLES.outstanding),
    );
    expect(EXAMPLE_CREDITORS).toHaveLength(EXAMPLE_PAYABLES.purchases);
    const dueThisWeek = EXAMPLE_CREDITORS.filter((creditor) => creditor.dueInDays <= 7);
    expect(sum(dueThisWeek.map((creditor) => creditor.minorUnits))).toBe(
      BigInt(EXAMPLE_PAYABLES.dueThisWeek),
    );
    expect(EXAMPLE_CREDITORS.every((creditor) => creditor.dueInDays >= 0)).toBe(true);
  });

  test("lists the largest overdue customers first, as the home does", () => {
    expect(EXAMPLE_DEBTORS.every((debtor) => debtor.dueInDays < 0)).toBe(true);
    const amounts = EXAMPLE_DEBTORS.map((debtor) => Number(debtor.minorUnits));
    expect(amounts).toEqual([...amounts].sort((left, right) => right - left));
  });

  test("moves the balances by exactly what the dictated sale says", () => {
    const sale = EXAMPLE_MOVEMENTS.find((movement) => movement.key === "dictatedSale");
    // "me dio cinco dólares y el resto me lo quedó debiendo" on a $9.75 sale.
    expect(sale?.amountMinorUnits).toBe("500");
    expect(BigInt(EXAMPLE_ACCOUNTS.cash) - BigInt(BEFORE_DICTATED_SALE.cash)).toBe(500n);
    expect(BigInt(EXAMPLE_RECEIVABLES.outstanding) - BigInt(BEFORE_DICTATED_SALE.receivables)).toBe(
      475n,
    );
  });

  test("reports the six complete months before the current one", () => {
    const months = exampleCashFlow(today);
    expect(months.map((month) => month.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    for (const month of months) {
      expect(BigInt(month.inflowMinorUnits) - BigInt(month.outflowMinorUnits)).toBe(
        BigInt(month.netMinorUnits),
      );
    }
  });
});
