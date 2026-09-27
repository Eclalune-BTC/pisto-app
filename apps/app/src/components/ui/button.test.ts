import type { ComponentProps } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: () => "cargando" }) }));

import { CashMovementList } from "@/features/cash/cash-movement-list";
import { Badge } from "./badge";
import { Button, ButtonText } from "./button";

describe("shared button", () => {
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
    const element = Button(props);
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
        "Confirmada",
      ),
    );
    expect(markup).toContain('aria-label="Estado de la cuenta"');
    expect(markup).toContain('data-testid="account-status"');
  });
});
