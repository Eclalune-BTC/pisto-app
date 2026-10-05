import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  platform: "android",
  select: vi.fn(),
  appearance: {
    choice: "light" as "light" | "dark" | "system",
    issue: null as "restore" | "save" | null,
    pending: false,
  },
}));
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
  useAppearance: () => ({ ...fixture.appearance, select: fixture.select }),
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: "tooltip",
  TooltipTrigger: "trigger",
  TooltipContent: "content",
}));

import { AppearanceControl } from "./appearance-control";
import { Button } from "./ui/button";

type ChoiceButton = ReactElement<{
  "aria-pressed"?: boolean;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}>;

function choiceButtons(): ChoiceButton[] {
  const group = AppearanceControl({}).props.children[0] as ReactElement<{
    children: ChoiceButton[];
    role: string;
  }>;
  expect(group.props.role).toBe("group");
  return group.props.children;
}

beforeEach(() => {
  fixture.select.mockClear();
  fixture.appearance = { choice: "light", issue: null, pending: false };
});

describe("appearance control platform boundary", () => {
  test.each(["android", "ios"])(
    "%s changes appearance without opening a tooltip overlay",
    (platform) => {
      fixture.platform = platform;
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

describe("full appearance control", () => {
  test("marks only the saved choice as pressed and saves the one pressed", () => {
    fixture.platform = "web";
    fixture.appearance.choice = "system";
    const buttons = choiceButtons();
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual([
      "settings.themes.light",
      "settings.themes.dark",
      "settings.themes.system",
    ]);
    expect(buttons.map((button) => button.props["aria-pressed"])).toEqual([false, false, true]);
    buttons[1]?.props.onPress();
    expect(fixture.select).toHaveBeenCalledExactlyOnceWith("dark");
  });

  test("locks every choice while a preference is restored or saved", () => {
    fixture.platform = "web";
    fixture.appearance.pending = true;
    expect(choiceButtons().every((button) => button.props.disabled)).toBe(true);
  });

  test("keeps a failed save visible as an alert", () => {
    fixture.platform = "web";
    fixture.appearance.issue = "save";
    const issue = AppearanceControl({}).props.children[1] as ReactElement<{
      accessibilityRole: string;
      children: string;
    }>;
    expect(issue.props.accessibilityRole).toBe("alert");
    expect(issue.props.children).toBe("appearance.errors.save");
  });
});
