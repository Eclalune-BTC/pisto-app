import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string[]) => names.map(() => "#1c1917"),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { Button } from "./button";
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

  test("empty states keep title, description and the authorized action, and nothing else", () => {
    const action = createElement(Button, { label: "Create", onPress: vi.fn() });
    const html = renderToStaticMarkup(
      EmptyState({ title: "No accounts", description: "Create an account first.", action }),
    );
    expect(html).toContain("No accounts");
    expect(html).toContain("Create an account first.");
    expect(html).toContain("Create");
    expect(html).toContain('aria-level="3"');
    const passive = renderToStaticMarkup(
      EmptyState({ title: "No accounts", description: "No matches." }),
    );
    expect(passive).not.toContain("<button");
  });
});
