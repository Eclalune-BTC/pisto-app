import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const setup = vi.hoisted(() => ({
  groups: [] as {
    value: string | undefined;
    disabled?: boolean;
    onValueChange: (value: string) => void;
  }[],
  labels: [] as { children?: unknown; onPress?: () => void }[],
  buttons: [] as { label?: string; onPress?: () => void }[],
  mutation: {
    error: null as Error | null,
    isPending: false,
    mutate: vi.fn(),
    variables: undefined as { currency: string; name: string; timeZone: string } | undefined,
  },
}));

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/ui/radio-group", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/radio-group")>();
  return {
    ...actual,
    RadioGroup: (props: ComponentProps<typeof actual.RadioGroup>) => {
      setup.groups.push(props);
      return createElement(actual.RadioGroup, props);
    },
  };
});
vi.mock("@/components/ui/label", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/label")>();
  return {
    ...actual,
    Label: (props: ComponentProps<typeof actual.Label>) => {
      setup.labels.push({
        children: props.children,
        onPress: props.onPress as (() => void) | undefined,
      });
      return createElement(actual.Label, props);
    },
  };
});
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
  selectActiveBusiness: vi.fn(),
}));

import BusinessSetupScreen from "@/app/(app)/business";
import { ChoiceList } from "@/features/cash/choice-list";
import { i18n } from "@/i18n/config";

beforeEach(() => {
  setup.buttons.length = 0;
  setup.groups.length = 0;
  setup.labels.length = 0;
  setup.mutation.error = null;
  setup.mutation.isPending = false;
  setup.mutation.variables = undefined;
  setup.mutation.mutate.mockClear();
});

describe("checked controls rendered by React Native Web", () => {
  test("exposes the business acknowledgment as an explicitly unchecked checkbox", () => {
    const markup = renderToStaticMarkup(createElement(BusinessSetupScreen));
    // The primitive assigns its web checkbox role in a layout effect; SSR retains its stable ID and checked state.
    const checkbox = markup.match(/<[^>]+\bid="business-acknowledgment"[^>]*>/)?.[0];
    expect(checkbox, markup).toContain('aria-checked="false"');
    expect(markup).toContain(i18n.t("business.acknowledgment"));
  });

  test("freezes all business inputs and acknowledgment while creation is pending", () => {
    setup.mutation.isPending = true;
    const markup = renderToStaticMarkup(createElement(BusinessSetupScreen));
    const inputs = markup.match(/<input\b(?![^>]*\btype="checkbox")[^>]*>/g);
    expect(inputs, markup).toHaveLength(3);
    for (const input of inputs ?? []) expect(input).toContain("readOnly");
    const checkbox = markup.match(/<[^>]+\bid="business-acknowledgment"[^>]*>/)?.[0];
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
    const markup = renderToStaticMarkup(createElement(BusinessSetupScreen));
    const checkbox = markup.match(/<[^>]+\bid="business-acknowledgment"[^>]*>/)?.[0];
    expect(checkbox).toContain('aria-disabled="true"');
    expect(markup).toContain(i18n.t("business.acknowledgment"));
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

describe("cash RNR selection behavior", () => {
  const options = [
    { label: "First account with a complete label", value: "first" },
    { label: "Second account with a complete label", value: "second" },
  ] as const;

  test("selects exact domain values through both the group and visible labels", () => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(ChoiceList, { label: "Account", options, value: "first", onChange }),
    );
    expect(markup).toContain('aria-label="Account"');
    for (const option of options) expect(markup).toContain(option.label);
    setup.groups[0]?.onValueChange("second");
    expect(onChange).toHaveBeenLastCalledWith("second");
    setup.labels.find((label) => label.children === options[0].label)?.onPress?.();
    expect(onChange).toHaveBeenLastCalledWith("first");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(() => setup.groups[0]?.onValueChange("missing")).toThrow("unavailable");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test("disables every radio and prevents changes through group or label handlers", () => {
    const onChange = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(ChoiceList, {
        disabled: true,
        label: "Account",
        options,
        value: "second",
        onChange,
      }),
    );
    const radios = markup.match(/<[^>]+\brole="radio"[^>]*>/g);
    expect(radios).toHaveLength(2);
    for (const radio of radios ?? []) {
      expect(radio).toMatch(/(?:aria-disabled="true"|\sdisabled(?:="")?)/);
    }
    expect(radios?.[1]).toContain('aria-checked="true"');
    setup.groups[0]?.onValueChange("first");
    for (const label of setup.labels) label.onPress?.();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("rejects an unavailable selected value without selecting the first option", () => {
    const onChange = vi.fn();
    expect(() =>
      renderToStaticMarkup(
        createElement(ChoiceList, { label: "Account", options, value: "missing", onChange }),
      ),
    ).toThrow("The selected cash choice is unavailable.");
    expect(onChange).not.toHaveBeenCalled();
  });
});
