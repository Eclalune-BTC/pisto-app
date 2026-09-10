import type { ReactElement } from "react";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  lock: { current: false },
  signIn: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [fixture.states.shift(), vi.fn()],
  useRef: () => fixture.lock,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: fixture.clear }) }));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: fixture.replace }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-native", () => ({
  KeyboardAvoidingView: "div",
  Platform: { OS: "web" },
  Pressable: "button",
  ScrollView: "div",
  Text: "span",
  View: "div",
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "div" }));
vi.mock("lucide-react-native", () => ({ Eye: "span", EyeOff: "span" }));
vi.mock("@/components/brand", () => ({ Brand: "span" }));
vi.mock("@/components/ui/alert", () => ({ Alert: "div" }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/card", () => ({ Card: "div", CardDescription: "span" }));
vi.mock("@/components/ui/field", () => ({ Field: "input" }));
vi.mock("@/components/ui/heading", () => ({ Heading: "h1" }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: fixture.signIn }, signUp: { email: fixture.signIn } },
}));

import { AuthScreen } from "./auth-screen";

function findSubmit(
  element: ReactElement<{ children?: ReactElement[]; onSubmitEditing?: () => Promise<void> }>,
): (() => Promise<void>) | undefined {
  if (element.props.onSubmitEditing) return element.props.onSubmitEditing;
  for (const child of [element.props.children].flat(Infinity) as ReactElement[]) {
    if (child && typeof child === "object" && "props" in child) {
      const found = findSubmit(child as Parameters<typeof findSubmit>[0]);
      if (found) return found;
    }
  }
}
beforeEach(() => {
  fixture.states = ["person@example.com", "Person", "password123", false, {}, undefined, false];
  fixture.lock.current = false;
  vi.clearAllMocks();
});

test.each(["sign-in", "sign-up"] as const)(
  "%s ignores repeated keyboard submission until the request settles",
  async (mode) => {
    let release!: (value: { error?: unknown }) => void;
    fixture.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const submit = findSubmit(AuthScreen({ mode }));
    expect(submit).toBeTypeOf("function");
    const first = submit?.();
    await submit?.();
    expect(fixture.signIn).toHaveBeenCalledTimes(1);
    release({ error: { status: 500 } });
    await first;
    fixture.signIn.mockResolvedValueOnce({});
    await submit?.();
    expect(fixture.signIn).toHaveBeenCalledTimes(2);
    expect(fixture.replace).toHaveBeenCalledExactlyOnceWith("/dashboard");
  },
);
