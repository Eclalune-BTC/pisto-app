import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#171717") : "#171717",
}));

import { LoadingIndicator } from "./loading-indicator";

describe("theme-owned activity indicator", () => {
  test("never delegates an unspecified color to the blue browser default", () => {
    expect(LoadingIndicator({}).props.color).toBe("#171717");
    expect(LoadingIndicator({ color: undefined }).props.color).toBe("#171717");
  });
  test("preserves explicit state colors and platform accessibility properties", () => {
    const result = LoadingIndicator({
      color: "#ffffff",
      size: "large",
      accessibilityLabel: "Loading accounts",
    });
    expect(result.props.color).toBe("#ffffff");
    expect(result.props.size).toBe("large");
    expect(result.props.accessibilityLabel).toBe("Loading accounts");
  });
});
