import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const setup = vi.hoisted(() => ({
  buttons: [] as { label?: string; onPress?: () => void }[],
  mutation: {
    error: null as Error | null,
    isPending: false,
    mutate: vi.fn(),
    variables: undefined as { currency: string; name: string; timeZone: string } | undefined,
  },
}));

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("lucide-react-native", () => ({ Building2: () => null, Check: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => setup.mutation,
  useQuery: () => ({
    data: { activeBusinessId: null, items: [] },
    fetchStatus: "idle",
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({
  api: { businesses: { create: vi.fn() } },
  isAmbiguousMutationError: (error: unknown) => error instanceof Error,
}));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/button")>();
  return {
    ...actual,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      setup.buttons.push({
        label: props.label,
        onPress: props.onPress as (() => void) | undefined,
      });
      return createElement(actual.Button, props);
    },
  };
});
vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: vi.fn() } },
}));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryKey: ["businesses"],
  businessesQueryOptions: {},
}));

import BusinessSetupScreen from "@/app/(app)/business";
import { ChoiceList } from "@/features/cash/choice-list";
import { i18n } from "@/i18n/config";

beforeEach(() => {
  setup.buttons.length = 0;
  setup.mutation.error = null;
  setup.mutation.isPending = false;
  setup.mutation.variables = undefined;
  setup.mutation.mutate.mockClear();
});

describe("checked controls rendered by React Native Web", () => {
  test("exposes the business acknowledgment as an explicitly unchecked checkbox", () => {
    const markup = renderToStaticMarkup(createElement(BusinessSetupScreen));
    const checkbox = markup.match(/<[^>]+\brole="checkbox"[^>]*>/)?.[0];
    expect(checkbox).toContain('aria-checked="false"');
    expect(markup).toContain(i18n.t("business.acknowledgment"));
  });

  test("freezes all business inputs and acknowledgment while creation is pending", () => {
    setup.mutation.isPending = true;
    const markup = renderToStaticMarkup(createElement(BusinessSetupScreen));
    const inputs = markup.match(/<input\b[^>]*>/g);
    expect(inputs).toHaveLength(3);
    for (const input of inputs ?? []) expect(input).toContain("readOnly");
    const checkbox = markup.match(/<[^>]+\brole="checkbox"[^>]*>/)?.[0];
    expect(checkbox).toContain('aria-disabled="true"');
    setup.buttons.find((button) => button.label === i18n.t("business.create"))?.onPress?.();
    expect(setup.mutation.mutate).not.toHaveBeenCalled();
  });

  test("retries the submitted business variables after an uncertain response", () => {
    const submitted = {
      currency: "USD",
      name: "Submitted store",
      timeZone: "America/El_Salvador",
    };
    setup.mutation.error = new Error("The response was lost");
    setup.mutation.variables = submitted;
    renderToStaticMarkup(createElement(BusinessSetupScreen));
    const retry = setup.buttons.find(
      (button) => button.label === i18n.t("common.retrySameConfirmation"),
    );
    expect(retry).toBeDefined();
    retry?.onPress?.();
    expect(setup.mutation.mutate).toHaveBeenCalledExactlyOnceWith(submitted);
    expect(setup.mutation.mutate.mock.calls[0]?.[0]).toBe(submitted);
  });

  test.each(["first", "second"])(
    "announces the selected %s cash choice and the unchecked alternative",
    (value) => {
      const markup = renderToStaticMarkup(
        createElement(ChoiceList, {
          label: "Cash account",
          onChange: () => undefined,
          options: [
            { label: "First account", value: "first" },
            { label: "Second account", value: "second" },
          ],
          value,
        }),
      );
      const radios = markup.match(/<[^>]+\brole="radio"[^>]*>/g);
      expect(radios).toHaveLength(2);
      expect(radios?.[0]).toContain(`aria-checked="${value === "first"}"`);
      expect(radios?.[1]).toContain(`aria-checked="${value === "second"}"`);
    },
  );
});
