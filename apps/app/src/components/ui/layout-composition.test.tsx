import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useCSSVariable: (names: string[]) => names.map(() => "#245c46") }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { Button } from "./button";
import { Card, CardFooter, CardHeader } from "./card";
import { EmptyState } from "./empty-state";
import { FilterToolbar } from "./filter-toolbar";
import { Text } from "./text";

describe("shared RNR layout composition", () => {
  test("filters expose a named group and preserve the reset action", () => {
    const reset = vi.fn();
    const element = FilterToolbar({
      label: "Filters",
      onReset: reset,
      resetLabel: "Reset",
      children: createElement(Text, {}, "Status"),
    });
    expect(element.props.role).toBe("group");
    expect(element.props.accessibilityLabel).toBe("Filters");
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Status");
    expect(html).toContain("Reset");
    const action = element.props.children[1] as ReactElement<{ onPress: () => void }>;
    expect(action.type).toBe(Button);
    action.props.onPress();
    expect(reset).toHaveBeenCalledOnce();
  });

  test("empty states keep title, description and authorized action in RNR card slots", () => {
    const action = createElement(Button, { label: "Create", onPress: vi.fn() });
    const element = EmptyState({
      title: "No accounts",
      description: "Create an account first.",
      action,
    });
    expect(element.type).toBe(Card);
    expect(element.props.children[0].type).toBe(CardHeader);
    expect(element.props.children[1].type).toBe(CardFooter);
    const html = renderToStaticMarkup(element);
    expect(html).toContain("No accounts");
    expect(html).toContain("Create an account first.");
    expect(html).toContain("Create");
    const passive = EmptyState({ title: "No accounts", description: "No matches." });
    expect(isValidElement(passive.props.children[1])).toBe(false);
  });
});
