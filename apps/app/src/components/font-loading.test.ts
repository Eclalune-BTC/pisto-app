import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  loaded: false,
  error: null as Error | null,
  effects: [] as (() => void)[],
  load: vi.fn(),
  prevent: vi.fn(),
  hide: vi.fn(),
  platform: { OS: "web" },
}));
vi.mock("@/global.css", () => ({}));
vi.mock("@rn-primitives/portal", () => ({ PortalHost: () => null }));
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@expo-google-fonts/inter/400Regular", () => ({ Inter_400Regular: 400 }));
vi.mock("@expo-google-fonts/inter/500Medium", () => ({ Inter_500Medium: 500 }));
vi.mock("@expo-google-fonts/inter/600SemiBold", () => ({ Inter_600SemiBold: 600 }));
vi.mock("expo-font", () => ({
  useFonts: (faces: unknown) => {
    fixture.load(faces);
    return [fixture.loaded, fixture.error];
  },
}));
vi.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: fixture.prevent,
  hideAsync: fixture.hide,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => fixture.effects.push(effect),
}));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#525252") : "#525252",
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("expo-router", () => ({
  DefaultTheme: {},
  DarkTheme: {},
  ThemeProvider: "div",
  Stack: Object.assign(() => null, { Screen: () => null }),
}));
vi.mock("expo-status-bar", () => ({ StatusBar: "div" }));
vi.mock("react-native", () => ({
  Platform: fixture.platform,
  ScrollView: "div",
  Text: "span",
  View: "div",
}));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/heading", () => ({ Heading: "h1" }));
vi.mock("@/i18n/config", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "div" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: "div", SafeAreaView: "div" }));
vi.mock("@/providers/appearance-provider", () => ({ AppearanceProvider: "div" }));
vi.mock("@/providers/i18n-provider", () => ({ I18nProvider: "div" }));
vi.mock("@/providers/query-provider", () => ({ QueryProvider: "div" }));

import RootLayout, { ErrorBoundary } from "@/app/_layout";

beforeEach(() => {
  fixture.loaded = false;
  fixture.error = null;
  fixture.effects = [];
  fixture.hide.mockClear();
  fixture.load.mockClear();
  fixture.platform.OS = "web";
});

afterEach(() => vi.unstubAllGlobals());

describe("bundled typography loading", () => {
  test.each(["web", "android"])(
    "provides explicit %s recovery without depending on failed fonts",
    (platform) => {
      fixture.platform.OS = platform;
      const reload = vi.fn();
      const retry = vi.fn(async () => undefined);
      vi.stubGlobal("window", { location: { reload } });
      const boundary = ErrorBoundary({ error: new Error("Private failure details"), retry });
      const content = boundary.props.children.props.children.props.children;
      const [heading, description, button] = content.props.children;
      expect(heading.props.children).toBe("startup.errorTitle");
      expect(description.props.children).toBe("startup.errorDescription");
      expect(heading.props.style.fontFamily).toBe(platform === "web" ? "system-ui" : "sans-serif");
      button.props.onPress();
      expect(reload).toHaveBeenCalledTimes(platform === "web" ? 1 : 0);
      expect(retry).toHaveBeenCalledTimes(platform === "web" ? 0 : 1);
    },
  );
  test("waits for the three exact font faces without dismissing the native splash", () => {
    expect(RootLayout()).toBeNull();
    expect(fixture.load).toHaveBeenCalledWith({
      PistoRegular: 400,
      PistoMedium: 500,
      PistoSemibold: 600,
    });
    for (const effect of fixture.effects) effect();
    expect(fixture.hide).not.toHaveBeenCalled();
  });

  test("renders the application once the bundled faces are ready", () => {
    fixture.loaded = true;
    expect(RootLayout()).not.toBeNull();
    for (const effect of fixture.effects) effect();
    expect(fixture.hide).toHaveBeenCalledOnce();
  });

  test("propagates a failed font asset to the route boundary without committing a layout effect", () => {
    fixture.error = new Error("Font asset unavailable");
    expect(() => RootLayout()).toThrow(fixture.error);
    expect(fixture.hide).not.toHaveBeenCalled();
  });
});
