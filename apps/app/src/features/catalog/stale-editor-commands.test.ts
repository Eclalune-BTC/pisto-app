import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
  queries: {} as Record<
    string,
    {
      data: unknown;
      error: unknown;
      fetchStatus: string;
      isPending: boolean;
      isFetching: boolean;
      isError: boolean;
      hasNextPage: boolean;
      isFetchingNextPage: boolean;
      refetch: () => void;
    }
  >,
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  mutation: { isPending: false, error: null as unknown, mutate: vi.fn(), reset: vi.fn() },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const index = fixture.index++;
    if (!(index in fixture.states))
      fixture.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      fixture.states[index],
      (value: unknown) => {
        fixture.states[index] = typeof value === "function" ? value(fixture.states[index]) : value;
      },
    ];
  },
  useEffect: (effect: () => void) => fixture.effects.push(effect),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => fixture.queries.businesses,
  useMutation: () => fixture.mutation,
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
vi.mock("expo-router", () => ({ Redirect: "redirect", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("expo-crypto", () => ({ randomUUID: fixture.randomUUID }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  Check: () => null,
  WifiOff: () => null,
}));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { business: unknown } | undefined) => data?.business,
}));
vi.mock("./queries", () => ({
  useCategoriesQuery: () => fixture.queries.categories,
  useProductQuery: () => fixture.queries.product,
}));
vi.mock("@/lib/api-client", () => ({ apiRequest: vi.fn() }));
vi.mock("./api", () => ({ catalogApi: { products: { create: vi.fn(), update: vi.fn() } } }));
vi.mock("../inventory/api", () => ({ inventoryApi: { recordMovement: vi.fn() } }));

import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { MovementEditor } from "../inventory/movement-editor";
import { MovementFormRoute } from "../inventory/movement-form-route";
import { ProductEditor } from "./product-editor";
import { ProductFormRoute } from "./product-form-route";

function query(data: unknown) {
  return {
    data,
    error: null as unknown,
    fetchStatus: "idle",
    isPending: false,
    isFetching: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  };
}
function render<T>(component: () => T): T {
  fixture.index = 0;
  fixture.effects = [];
  const result = component();
  for (const effect of fixture.effects) effect();
  return result;
}
function elements<P>(node: ReactNode, type: unknown): ReactElement<P>[] {
  const result: ReactElement<P>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === type) result.push(child as ReactElement<P>);
    result.push(...elements<P>(child.props.children, type));
  });
  return result;
}
const product = {
  id: "product",
  name: "Coffee",
  status: "active",
  categoryId: null,
  lowStockThresholdMinorUnits: null,
  quantityPrecision: 0,
  sellingPriceMinorUnits: "500",
  sellingPriceCurrencyMinorUnitDigits: 2,
  sku: null,
  tracked: true,
  unitKind: "unit",
};
beforeEach(() => {
  fixture.states = [];
  fixture.mutation.isPending = false;
  fixture.mutation.error = null;
  vi.clearAllMocks();
  fixture.queries = {
    businesses: query({
      business: {
        id: "business",
        name: "Shop",
        timeZone: "UTC",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        access: { permissions: ["catalog:manage", "catalog:read", "inventory:manage"] },
      },
    }),
    categories: query({ pages: [{ items: [] }] }),
    product: query({ product, stock: { quantityMinorUnits: "500" } }),
  };
});

const cases = [
  { editor: "create", dependency: "businesses" },
  { editor: "create", dependency: "categories" },
  { editor: "edit", dependency: "businesses" },
  { editor: "edit", dependency: "categories" },
  { editor: "edit", dependency: "product" },
  { editor: "movement", dependency: "businesses" },
  { editor: "movement", dependency: "product" },
] as const;

describe.each(["paused", "error"] as const)("cached %s editor dependencies", (failure) => {
  test.each(cases)(
    "$editor preserves its command when $dependency cannot refresh",
    ({ editor, dependency }) => {
      const renderScreen = () => {
        if (editor === "movement") {
          const screen = render(() => MovementFormRoute({ productId: "product" }));
          expect(screen.type).toBe(MovementEditor);
          return screen as ReactElement<ComponentProps<typeof MovementEditor>>;
        }
        const screen = render(() =>
          ProductFormRoute({ mode: editor, productId: editor === "edit" ? "product" : undefined }),
        );
        expect(screen.type).toBe(ProductEditor);
        return screen as ReactElement<ComponentProps<typeof ProductEditor>>;
      };
      if (editor === "movement") render(() => MovementFormRoute({ productId: "product" }));
      else render(() => ProductFormRoute({ mode: editor, productId: "product" }));
      let screen = renderScreen();
      if (editor === "movement") {
        const movement = screen as ReactElement<ComponentProps<typeof MovementEditor>>;
        movement.props.onDraftChange({
          ...movement.props.draft,
          quantity: "5",
          reason: "Delivery",
        });
      } else {
        const catalog = screen as ReactElement<ComponentProps<typeof ProductEditor>>;
        catalog.props.onDraftChange({ ...catalog.props.draft, name: "Updated coffee" });
      }
      screen = renderScreen();
      const draft = screen.props.draft;
      const failRead = () => {
        const source = fixture.queries[dependency];
        if (!source) throw new Error("Missing query fixture");
        if (failure === "paused") source.fetchStatus = "paused";
        else {
          source.isError = true;
          source.error = new ApiClientError("Unavailable", 503);
        }
      };
      const recoverRead = () => {
        const source = fixture.queries[dependency];
        if (!source) throw new Error("Missing query fixture");
        Object.assign(source, {
          fetchStatus: "idle",
          isError: false,
          error: null,
        });
      };
      failRead();
      screen = renderScreen();
      expect(screen.props.draft).toBe(draft);
      expect(screen.props.isStale).toBe(true);
      const editorTree =
        editor === "movement"
          ? MovementEditor((screen as ReactElement<ComponentProps<typeof MovementEditor>>).props)
          : ProductEditor((screen as ReactElement<ComponentProps<typeof ProductEditor>>).props);
      expect(elements(editorTree, StaleNotice)).toHaveLength(1);
      const reviewButton = elements<ComponentProps<typeof Button>>(editorTree, Button).find(
        ({ props }) => props.label === screen.props.copy.review,
      );
      expect(reviewButton?.props.disabled).toBe(true);
      expect(reviewButton?.props.onPress).toBeUndefined();
      screen.props.onReview();
      screen.props.onConfirm();
      expect(fixture.randomUUID).not.toHaveBeenCalled();
      expect(fixture.mutation.mutate).not.toHaveBeenCalled();
      expect(renderScreen().props.reviewItems).toBeNull();

      recoverRead();
      renderScreen().props.onReview();
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      failRead();
      screen = renderScreen();
      expect(screen.props.reviewItems).not.toBeNull();
      screen.props.onConfirm();
      expect(fixture.mutation.mutate).not.toHaveBeenCalled();
      const beforeRefresh = fixture.states.slice();
      const refreshTree =
        editor === "movement"
          ? MovementEditor((screen as ReactElement<ComponentProps<typeof MovementEditor>>).props)
          : ProductEditor((screen as ReactElement<ComponentProps<typeof ProductEditor>>).props);
      const notice = elements<ComponentProps<typeof StaleNotice>>(refreshTree, StaleNotice)[0];
      if (!notice) throw new Error("Missing stale notice");
      const retry = elements<ComponentProps<typeof Button>>(StaleNotice(notice.props), Button)[0];
      if (!retry) throw new Error("Missing refresh action");
      (retry.props.onPress as (() => void) | undefined)?.();
      const sources =
        editor === "create"
          ? ["businesses", "categories"]
          : editor === "edit"
            ? ["businesses", "categories", "product"]
            : ["businesses", "product"];
      for (const source of sources)
        expect(fixture.queries[source]?.refetch).toHaveBeenCalledTimes(1);
      fixture.states.forEach((value, index) => {
        expect(value).toBe(beforeRefresh[index]);
      });
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      expect(fixture.mutation.reset).toHaveBeenCalledTimes(1);
      const refreshingSource = fixture.queries[dependency];
      if (!refreshingSource) throw new Error("Missing query fixture");
      refreshingSource.isFetching = true;
      expect(renderScreen().props.isRefreshing).toBe(true);
      refreshingSource.isFetching = false;
      recoverRead();
      expect(renderScreen().props.isStale).toBe(false);
      fixture.states.forEach((value, index) => {
        expect(value).toBe(beforeRefresh[index]);
      });
      renderScreen().props.onConfirm();
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(1);
      const originalCommand = fixture.mutation.mutate.mock.calls[0]?.[0];
      expect(originalCommand.idempotencyKey).toBe("11111111-1111-4111-8111-111111111111");
      fixture.mutation.isPending = true;
      failRead();
      screen = renderScreen();
      screen.props.onConfirm();
      screen.props.onEditReview();
      screen.props.onReview();
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(1);
      expect(renderScreen().props.reviewItems).not.toBeNull();
      fixture.mutation.isPending = false;
      fixture.mutation.error = new ApiClientError("Response lost", 0);
      screen = renderScreen();
      expect(screen.props.mutationState).toBe("uncertain");
      screen.props.onEditReview();
      screen.props.onReview();
      screen.props.onResolveUncertain();
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(2);
      expect(fixture.mutation.mutate.mock.calls[1]?.[0]).toBe(originalCommand);
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      expect(fixture.mutation.reset).toHaveBeenCalledTimes(1);
    },
  );
});

test.each(["create", "edit", "movement"] as const)(
  "%s hides cached editors after a current membership denial",
  (editor) => {
    const denied = fixture.queries.businesses;
    if (!denied) throw new Error("Missing business fixture");
    denied.fetchStatus = "paused";
    denied.isError = true;
    denied.error = new ApiClientError("Denied", 403, "FORBIDDEN");
    const screen =
      editor === "movement"
        ? render(() => MovementFormRoute({ productId: "product" }))
        : render(() => ProductFormRoute({ mode: editor, productId: "product" }));
    expect(screen.props.kind).toBe("denied");
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    expect(fixture.randomUUID).not.toHaveBeenCalled();
  },
);
