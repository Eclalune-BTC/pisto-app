import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string[]) =>
    names.map((name) =>
      name === "--color-selection"
        ? "#D4D4D4"
        : name === "--color-muted-foreground"
          ? "#525252"
          : "#171717",
    ),
}));

import { Input } from "./input";
import { Textarea } from "./textarea";

describe("native input colors", () => {
  test.each([Input, Textarea])(
    "keeps neutral selection distinct from the text and cursor",
    (Component) => {
      const input = Component({});
      expect(input.props.selectionColor).toBe("#D4D4D4");
      expect(input.props.cursorColor).toBe("#171717");
      expect(input.props.selectionHandleColor).toBe("#171717");
      expect(input.props.placeholderTextColor).toBe("#525252");
    },
  );
});
