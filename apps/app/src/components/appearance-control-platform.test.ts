import { describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ platform: "android", select: vi.fn() }));
vi.mock("react-native", async () => ({
  ...(await vi.importActual<typeof import("react-native")>("react-native-web")),
  Platform: {
    get OS() {
      return fixture.platform;
    },
    select: (choices: Record<string, unknown>) => choices[fixture.platform] ?? choices.default,
  },
}));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/providers/appearance-provider", () => ({
  useAppearance: () => ({ pending: false, issue: null, choice: "light", select: fixture.select }),
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: "tooltip",
  TooltipTrigger: "trigger",
  TooltipContent: "content",
}));

import { AppearanceControl } from "./appearance-control";
import { Button } from "./ui/button";

describe("appearance control platform boundary", () => {
  test.each(["android", "ios"])(
    "%s changes appearance without opening a tooltip overlay",
    (platform) => {
      fixture.platform = platform;
      fixture.select.mockClear();
      const control = AppearanceControl({ compact: true }).props.children[0];
      expect(control.type).toBe(Button);
      control.props.onPress();
      expect(fixture.select).toHaveBeenCalledExactlyOnceWith("dark");
    },
  );
  test("web retains the registry hover tooltip", () => {
    fixture.platform = "web";
    const control = AppearanceControl({ compact: true }).props.children[0];
    expect(control.type).toBe("tooltip");
  });
});
