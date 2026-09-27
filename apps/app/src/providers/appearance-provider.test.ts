import { beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => (() => void) | undefined)[],
  busy: { current: true },
  theme: "light",
  adaptive: true,
  read: vi.fn(),
  write: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = fixture.index++;
    if (!(index in fixture.states)) fixture.states[index] = initial;
    return [
      fixture.states[index],
      (value: unknown) => {
        fixture.states[index] = value;
      },
    ];
  },
  useRef: () => fixture.busy,
  useEffect: (effect: () => (() => void) | undefined) => fixture.effects.push(effect),
}));
vi.mock("uniwind", () => ({
  Uniwind: { setTheme: fixture.setTheme },
  useUniwind: () => ({ hasAdaptiveThemes: fixture.adaptive, theme: fixture.theme }),
}));
vi.mock("@/lib/appearance-preference", () => ({
  readAppearancePreference: fixture.read,
  writeAppearancePreference: fixture.write,
  parseAppearanceChoice: (value: string) => value,
}));

import { AppearanceProvider } from "./appearance-provider";

function render() {
  fixture.index = 0;
  fixture.effects = [];
  return AppearanceProvider({ children: null }).props.value;
}

async function restore() {
  render();
  fixture.effects[0]?.();
  await vi.waitFor(() => expect(render().pending).toBe(false));
}

beforeEach(() => {
  fixture.states = [];
  fixture.busy.current = true;
  fixture.theme = "light";
  fixture.adaptive = true;
  vi.resetAllMocks();
  fixture.read.mockResolvedValue("system");
  fixture.write.mockResolvedValue(undefined);
  fixture.setTheme.mockImplementation((choice: string) => {
    fixture.adaptive = choice === "system";
    if (choice !== "system") fixture.theme = choice;
  });
});

describe("shared appearance state", () => {
  test("restores the saved choice before allowing another selection", async () => {
    fixture.read.mockResolvedValue("dark");
    expect(render().pending).toBe(true);
    await render().select("light");
    expect(fixture.write).not.toHaveBeenCalled();
    await restore();
    expect(render()).toMatchObject({ choice: "dark", pending: false, issue: null });
  });

  test("retains the existing theme until a write succeeds and ignores repeated activation", async () => {
    await restore();
    let finish!: () => void;
    fixture.write.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = render().select("dark");
    await render().select("light");
    expect(fixture.write).toHaveBeenCalledTimes(1);
    expect(render()).toMatchObject({ choice: "system", pending: true });
    finish();
    await first;
    expect(render()).toMatchObject({ choice: "dark", pending: false, issue: null });
  });

  test("shows restoration failure and lets an explicit choice repair the preference", async () => {
    const diagnostic = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      fixture.read.mockRejectedValue(new Error("Invalid stored preference"));
      await restore();
      expect(render()).toMatchObject({ issue: "restore", pending: false });
      expect(fixture.setTheme).not.toHaveBeenCalled();
      await render().select("dark");
      expect(render()).toMatchObject({ issue: null, choice: "dark" });
      expect(diagnostic).toHaveBeenCalledExactlyOnceWith(
        "Appearance preference could not be restored",
      );
    } finally {
      diagnostic.mockRestore();
    }
  });

  test("does not change appearance or report success after a rejected write", async () => {
    await restore();
    const diagnostic = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      fixture.write.mockRejectedValue(new Error("Storage unavailable"));
      await render().select("dark");
      expect(render()).toMatchObject({ choice: "system", issue: "save", pending: false });
      expect(fixture.setTheme).not.toHaveBeenCalledWith("dark");
    } finally {
      diagnostic.mockRestore();
    }
  });

  test("does not apply a late restore from an unmounted provider", async () => {
    let finish!: (choice: string) => void;
    fixture.read.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render();
    const cleanup = fixture.effects[0]?.();
    cleanup?.();
    finish("dark");
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.setTheme).not.toHaveBeenCalled();
  });
});
