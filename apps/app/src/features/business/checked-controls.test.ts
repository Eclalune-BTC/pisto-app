import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("expo-router", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("lucide-react-native", () => ({ Building2: () => null, Check: () => null }));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ error: null, isPending: false, mutate: vi.fn() }),
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
  isAmbiguousMutationError: () => false,
}));
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

describe("checked controls rendered by React Native Web", () => {
  test("exposes the business acknowledgment as an explicitly unchecked checkbox", () => {
    const markup = renderToStaticMarkup(createElement(BusinessSetupScreen));
    const checkbox = markup.match(/<[^>]+\brole="checkbox"[^>]*>/)?.[0];
    expect(checkbox).toContain('aria-checked="false"');
    expect(markup).toContain(i18n.t("business.acknowledgment"));
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
