import type { ComponentProps } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const appearance = vi.hoisted(() => ({ theme: "light" }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string[]) => {
    const colors: Record<string, string> =
      appearance.theme === "dark"
        ? {
            "--color-primary-foreground": "#203a29",
            "--color-destructive-action-foreground": "#431b16",
            "--color-foreground": "#edf1e7",
          }
        : {
            "--color-primary-foreground": "#ffffff",
            "--color-destructive-action-foreground": "#ffffff",
            "--color-foreground": "#24362d",
          };
    return names.map((name) => colors[name]);
  },
  useUniwind: () => appearance,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: () => "cargando" }) }));

import { CashMovementList } from "@/features/cash/cash-movement-list";
import { Badge } from "./badge";
import { Button, ButtonText } from "./button";

beforeEach(() => {
  appearance.theme = "light";
});

describe("shared button", () => {
  test.each([
    ["light", "destructive", "#ffffff"],
    ["dark", "destructive", "#431b16"],
    ["dark", "default", "#203a29"],
    ["light", "default", "#ffffff"],
  ] as const)("preserves loading contrast for %s %s controls", (theme, variant, color) => {
    appearance.theme = theme;
    const rendered = Button({ loading: true, variant, label: "Guardar" });
    expect(rendered.props.children.props.children.props.children[0].props.color).toBe(color);
  });
  test("preserves the link role and destination supplied by a router", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, {
        label: "Abrir catálogo",
        accessibilityRole: "link",
        href: "/operate/catalog",
      } as ComponentProps<typeof Button>),
    );
    expect(markup).toContain('href="/operate/catalog"');
    expect(markup).not.toContain('role="button"');
    expect(markup).toContain("Abrir catálogo");
  });

  test("retains a composed action name and becomes busy and disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { loading: true }, createElement(ButtonText, {}, "Guardar")),
    );
    expect(markup).toContain('role="button"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Guardar");
  });

  test("provides an accessible icon control and forwards presentation overrides", () => {
    const props: ComponentProps<typeof Button> = {
      size: "icon",
      variant: "ghost",
      accessibilityLabel: "Mostrar contraseña",
      testID: "password-toggle",
      className: "rounded-none",
      disabled: true,
    };
    const markup = renderToStaticMarkup(createElement(Button, props));
    expect(markup).toContain('aria-label="Mostrar contraseña"');
    expect(markup).toContain('data-testid="password-toggle"');
    expect(markup).toContain('aria-disabled="true"');
    const element = Button(props).props.children;
    expect(element.props.className).toContain("min-h-11");
    expect(element.props.className).toContain("w-11");
    expect(element.props.className).toContain("rounded-none");
  });

  test("renders a passive movement row without a disabled button", () => {
    const props: ComponentProps<typeof CashMovementList> = {
      movements: [
        {
          id: "movement",
          action: "opening",
          occurredLocalDate: "2026-09-01",
          occurredLocalTime: "12:00",
          deltaMinorUnits: "100",
          currency: "USD",
          currencyMinorUnitDigits: 2,
        } as never,
      ],
      noMovements: "Sin movimientos",
      actionLabels: { opening: "Saldo inicial" } as never,
      formatMoney: () => "$1.00",
    };
    const passive = renderToStaticMarkup(createElement(CashMovementList, props));
    expect(passive).not.toContain('role="button"');
    expect(passive).not.toContain("aria-disabled");
    const actionable = renderToStaticMarkup(
      createElement(CashMovementList, { ...props, onOpenMovement: vi.fn() }),
    );
    expect(actionable).toContain('role="button"');
    expect(actionable).toContain("Saldo inicial");
  });

  test("forwards the badge accessibility properties instead of discarding them", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Badge,
        { accessibilityLabel: "Estado de la cuenta", testID: "account-status" },
        createElement(ButtonText, {}, "Confirmada"),
      ),
    );
    expect(markup).toContain('aria-label="Estado de la cuenta"');
    expect(markup).toContain('data-testid="account-status"');
  });
});
