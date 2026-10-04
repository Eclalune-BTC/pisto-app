import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const captured = vi.hoisted(() => ({
  value: undefined as { value: string; label: string } | undefined,
  change: undefined as ((option: { value: string; label: string }) => void) | undefined,
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#62626B") : "#62626B",
}));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  Check: () => null,
  ChevronDown: () => null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: typeof captured.value;
    onValueChange: typeof captured.change;
  }) => {
    captured.value = value;
    captured.change = onValueChange;
    return children;
  },
  SelectTrigger: ({ children }: { children: ReactNode }) => children,
  SelectContent: () => null,
  SelectItem: () => null,
}));

import { SelectField } from "./select-field";

describe("controlled selection boundary", () => {
  const options = [
    { label: "First account", value: "a" },
    { label: "Second account", value: "b" },
  ];
  const render = (value: string | null, currentOptions = options, onChange = vi.fn()) =>
    renderToStaticMarkup(
      createElement(SelectField, { label: "Account", value, options: currentOptions, onChange }),
    );

  test("stays controlled through null, choice and reset, then permits the same choice again", () => {
    const onChange = vi.fn();
    render(null, options, onChange);
    expect(captured.value?.value).toBe("");
    captured.change?.({ value: "a", label: "a" });
    render("a", options, onChange);
    expect(captured.value).toEqual(options[0]);
    render(null, options, onChange);
    expect(captured.value?.value).toBe("");
    captured.change?.({ value: "a", label: "a" });
    expect(onChange.mock.calls).toEqual([["a"], ["a"]]);
  });

  test("keeps an unavailable choice explicit and restores its real label when options return", () => {
    expect(render("a", [])).toContain("filters.selectionUnavailable");
    expect(captured.value?.value).toBe("a");
    expect(render("a")).toContain("First account");
    expect(captured.value).toEqual(options[0]);
  });

  test("refuses a value that was not supplied by the current options", () => {
    const onChange = vi.fn();
    render(null, options, onChange);
    expect(() => captured.change?.({ value: "unknown", label: "Unknown" })).toThrow(
      "current option set",
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
