import type { ReactElement } from "react";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
  session: {
    data: null as { user: { id: string } } | null,
    error: null as unknown,
    isPending: false,
    isRefetching: false,
    refetch: vi.fn(),
  },
  lock: { current: false },
  signIn: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = fixture.index++;
    if (!(index in fixture.states)) fixture.states[index] = initial;
    return [
      fixture.states[index],
      (value: unknown) => {
        fixture.states[index] = typeof value === "function" ? value(fixture.states[index]) : value;
      },
    ];
  },
  useEffect: (effect: () => void) => fixture.effects.push(effect),
  useRef: () => fixture.lock,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: fixture.clear }) }));
vi.mock("expo-router", () => ({ Link: "a", useRouter: () => ({ replace: fixture.replace }) }));
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
  authClient: {
    signIn: { email: fixture.signIn },
    signUp: { email: fixture.signIn },
    useSession: () => fixture.session,
  },
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
function render(mode: "sign-in" | "sign-up" = "sign-in") {
  fixture.index = 0;
  fixture.effects = [];
  const element = AuthScreen({ mode });
  for (const effect of fixture.effects) effect();
  return element;
}

beforeEach(() => {
  fixture.states = ["person@example.com", "Person", "password123", false, {}, undefined, false];
  fixture.lock.current = false;
  fixture.session.data = null;
  fixture.session.error = null;
  fixture.session.isPending = false;
  fixture.session.isRefetching = false;
  vi.resetAllMocks();
});

test.each(["sign-in", "sign-up"] as const)(
  "%s ignores repeated keyboard submission and allows retry after rejection",
  async (mode) => {
    let release!: (value: { error?: unknown }) => void;
    fixture.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const submit = findSubmit(render(mode));
    const first = submit?.();
    await submit?.();
    expect(fixture.signIn).toHaveBeenCalledTimes(1);
    release({ error: { status: 500 } });
    await first;
    fixture.signIn.mockResolvedValueOnce({ error: { status: 401 } });
    await findSubmit(render(mode))?.();
    expect(fixture.signIn).toHaveBeenCalledTimes(2);
    expect(fixture.replace).not.toHaveBeenCalled();
  },
);

test.each(["sign-in", "sign-up"] as const)(
  "%s waits for the expected session atom after the POST and an interrupted refresh settle",
  async (mode) => {
    let release!: () => void;
    fixture.session.data = { user: { id: "previous-user" } };
    fixture.session.refetch.mockImplementationOnce(() => {
      fixture.session.isRefetching = true;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    fixture.signIn.mockResolvedValue({ data: { user: { id: "expected-user" } } });
    await findSubmit(render(mode))?.();
    await findSubmit(render(mode))?.();
    expect(fixture.session.refetch).toHaveBeenCalledExactlyOnceWith({
      query: { disableCookieCache: true },
    });
    expect(fixture.signIn).toHaveBeenCalledTimes(1);
    expect(fixture.replace).not.toHaveBeenCalled();
    expect(fixture.states[6]).toBe(true);

    // Better Auth can abort this refresh when its delayed sign-in signal starts another.
    release();
    await vi.waitFor(() => expect(fixture.states[8]).toBe(true));
    render(mode);
    expect(fixture.replace).not.toHaveBeenCalled();
    expect(fixture.lock.current).toBe(true);

    fixture.session.data = { user: { id: "expected-user" } };
    fixture.session.isRefetching = false;
    render(mode);
    render(mode);
    expect(fixture.clear).toHaveBeenCalledTimes(1);
    expect(fixture.replace).toHaveBeenCalledExactlyOnceWith("/dashboard");
    expect(fixture.states[6]).toBe(false);
  },
);

test.each(["error", "empty", "other-user", "rejection"] as const)(
  "session refresh %s releases submission with visible error and no navigation",
  async (outcome) => {
    fixture.signIn.mockResolvedValue({ data: { user: { id: "expected-user" } } });
    fixture.session.refetch.mockImplementationOnce(async () => {
      if (outcome === "rejection") throw new Error("Connection failed");
      if (outcome === "error") fixture.session.error = { status: 500 };
      if (outcome === "other-user") fixture.session.data = { user: { id: "previous-user" } };
    });
    await findSubmit(render())?.();
    await vi.waitFor(() => expect(fixture.states[8]).toBe(true));
    render();
    expect(fixture.replace).not.toHaveBeenCalled();
    expect(fixture.clear).not.toHaveBeenCalled();
    expect(fixture.states[5]).toBe("auth.errors.connection");
    expect(fixture.states[6]).toBe(false);
    expect(fixture.lock.current).toBe(false);
  },
);
