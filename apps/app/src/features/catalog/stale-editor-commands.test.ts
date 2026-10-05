import type { Product } from "@pisto/contracts";
import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

type Read = {
  data: unknown;
  error: unknown;
  fetchStatus: string;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: () => void;
};

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
  queries: {} as Record<string, Read>,
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  mutation: {
    isPending: false,
    isError: false,
    error: null as unknown,
    variables: undefined as unknown,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useId: () => "field",
  useMemo: (factory: () => unknown) => factory(),
  useRef: (initial: unknown) => ({ current: initial }),
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
  useQuery: (options: { queryKey: readonly unknown[] }) =>
    options.queryKey[0] === "businesses" ? fixture.queries.businesses : fixture.queries.product,
  useInfiniteQuery: () => fixture.queries.history,
  useMutation: () => fixture.mutation,
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
vi.mock("expo-router", () => ({
  Link: "link",
  Redirect: "redirect",
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: fixture.randomUUID }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#62626B") : "#62626B",
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("@/components/shell/shell-context", () => ({
  useRouteLabel: () => undefined,
  useShellTopInset: () => 0,
}));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { business: unknown } | undefined) => data?.business,
}));
vi.mock("./queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./queries")>()),
  useCategoryChoices: () => fixture.queries.categories,
}));
vi.mock("@/lib/api-client", () => ({ api: {} }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn() } }));
vi.mock("./api", () => ({ catalogApi: { products: { create: vi.fn(), update: vi.fn() } } }));
vi.mock("../inventory/api", () => ({ inventoryApi: { recordMovement: vi.fn() } }));

import { FormActions } from "@/components/layout/form-actions";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { elements } from "../../../test-support/element-tree";
import { MovementFormRoute } from "../inventory/movement-form-controller";
import { MovementFormScreen } from "../inventory/movement-form-screen";
import type { ProductCommand } from "./product-draft";
import { ProductFormRoute, productSaveMessage } from "./product-form-controller";
import { ProductFormScreen } from "./product-form-screen";

function read(data: unknown): Read {
  return {
    data,
    error: null,
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
const product = {
  id: "product",
  name: "Coffee",
  status: "active",
  categoryId: null,
  lowStockThresholdMinorUnits: null,
  quantityPrecision: 0,
  sellingPriceMinorUnits: "500",
  sellingPriceCurrency: "USD",
  sellingPriceCurrencyMinorUnitDigits: 2,
  sku: null,
  tracked: true,
  unitKind: "unit",
  createdAt: "2026-09-26T12:00:00.000Z",
  updatedAt: "2026-09-26T12:00:00.000Z",
};
const stock = {
  productId: "product",
  onHandMinorUnits: "500",
  quantityPrecision: 0,
  lowStockThresholdMinorUnits: null,
  lowStock: false,
};
beforeEach(() => {
  fixture.states = [];
  Object.assign(fixture.mutation, { isPending: false, isError: false, error: null });
  vi.clearAllMocks();
  fixture.queries = {
    businesses: read({
      business: {
        id: "business",
        name: "Shop",
        timeZone: "UTC",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        access: {
          permissions: ["catalog:manage", "catalog:read", "inventory:manage", "inventory:read"],
        },
      },
    }),
    categories: read({ pages: [{ items: [], nextCursor: null }] }),
    history: read({ pages: [{ items: [], nextCursor: null }] }),
    product: read({ product, stock }),
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

type ProductScreen = ReactElement<ComponentProps<typeof ProductFormScreen>>;
type MovementScreen = ReactElement<ComponentProps<typeof MovementFormScreen>>;

describe.each(["paused", "error"] as const)("cached %s editor dependencies", (failure) => {
  test.each(cases)(
    "$editor keeps its command when $dependency cannot refresh",
    ({ editor, dependency }) => {
      const renderScreen = () => {
        if (editor === "movement") {
          const screen = render(() => MovementFormRoute({ productId: "product" }));
          expect(screen.type).toBe(MovementFormScreen);
          return screen as MovementScreen;
        }
        const screen = render(() =>
          ProductFormRoute({ mode: editor, productId: editor === "edit" ? "product" : undefined }),
        );
        expect(screen.type).toBe(ProductFormScreen);
        return screen as ProductScreen;
      };
      const tree = (screen: ProductScreen | MovementScreen) =>
        editor === "movement"
          ? MovementFormScreen((screen as MovementScreen).props)
          : ProductFormScreen((screen as ProductScreen).props);
      // The first render seeds the draft; the form appears on the next one.
      render(() =>
        editor === "movement"
          ? MovementFormRoute({ productId: "product" })
          : ProductFormRoute({ mode: editor, productId: "product" }),
      );
      let screen = renderScreen();
      if (editor === "movement") {
        const movement = screen as MovementScreen;
        movement.props.onDraftChange({
          ...movement.props.draft,
          quantity: "5",
          reason: "Delivery",
        });
      } else {
        const catalog = screen as ProductScreen;
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
        Object.assign(source, { fetchStatus: "idle", isError: false, error: null });
      };
      failRead();
      screen = renderScreen();
      expect(screen.props.draft).toBe(draft);
      expect(screen.props.isStale).toBe(true);
      const staleTree = tree(screen);
      expect(elements(staleTree, StaleNotice)).toHaveLength(1);
      const reviewLabel =
        editor === "movement" ? "inventory.movementEditor.review" : "catalog.form.review";
      const reviewActions = elements<ComponentProps<typeof FormActions>>(
        staleTree,
        FormActions,
      ).find(({ props }) => props.submitLabel === reviewLabel);
      // FormActions drops the press handler of a disabled submit.
      expect(reviewActions?.props.disabled).toBe(true);
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
      const notice = elements<ComponentProps<typeof StaleNotice>>(tree(screen), StaleNotice)[0];
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
      for (const source of sources) {
        expect(fixture.queries[source]?.refetch).toHaveBeenCalledTimes(1);
      }
      fixture.states.forEach((value, index) => {
        expect(value).toBe(beforeRefresh[index]);
      });
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      expect(fixture.mutation.reset).toHaveBeenCalledTimes(1);
      const refreshing = fixture.queries[dependency];
      if (!refreshing) throw new Error("Missing query fixture");
      refreshing.isFetching = true;
      expect(renderScreen().props.isRefreshing).toBe(true);
      refreshing.isFetching = false;
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
      expect(screen.props.phase).toBe("pending");
      screen.props.onConfirm();
      screen.props.onEditReview();
      screen.props.onReview();
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(1);
      expect(renderScreen().props.reviewItems).not.toBeNull();

      fixture.mutation.isPending = false;
      Object.assign(fixture.mutation, {
        error: new ApiClientError("Response lost", 0),
        isError: true,
      });
      screen = renderScreen();
      expect(screen.props.phase).toBe("uncertain");
      screen.props.onEditReview();
      screen.props.onReview();
      screen.props.onConfirm();
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(2);
      expect(fixture.mutation.mutate.mock.calls[1]?.[0]).toBe(originalCommand);
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      expect(fixture.mutation.reset).toHaveBeenCalledTimes(1);
    },
  );
});

test.each(["create", "edit", "movement"] as const)(
  "%s hides a cached editor after a current membership denial",
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

test("refuses an outbound movement larger than the balance before reviewing it", () => {
  render(() => MovementFormRoute({ productId: "product" }));
  let screen = render(() => MovementFormRoute({ productId: "product" })) as MovementScreen;
  screen.props.onDraftChange({
    ...screen.props.draft,
    action: "adjust_out",
    quantity: "501",
    reason: "Damaged",
  });
  screen = render(() => MovementFormRoute({ productId: "product" })) as MovementScreen;
  screen.props.onReview();
  screen = render(() => MovementFormRoute({ productId: "product" })) as MovementScreen;
  expect(screen.props.reviewItems).toBeNull();
  expect(screen.props.errors.quantity).toBe("inventory.movementEditor.validation.insufficient");

  screen.props.onDraftChange({ ...screen.props.draft, quantity: "500" });
  screen = render(() => MovementFormRoute({ productId: "product" })) as MovementScreen;
  screen.props.onReview();
  screen = render(() => MovementFormRoute({ productId: "product" })) as MovementScreen;
  expect(screen.props.reviewItems).not.toBeNull();
});

describe("product edit after inventory movements", () => {
  type Screen = ReactElement<ComponentProps<typeof ProductFormScreen>>;
  const renderEdit = () =>
    render(() => ProductFormRoute({ mode: "edit", productId: "product" })) as Screen;

  beforeEach(() => {
    // A zero balance proves nothing about history; only the history read can.
    fixture.queries.product = read({ product, stock: { ...stock, onHandMinorUnits: "0" } });
  });

  test("waits for the history, then freezes the unit, decimals and tracking", () => {
    fixture.queries.history = {
      ...read(undefined),
      fetchStatus: "fetching",
      isFetching: true,
      isPending: true,
    };
    renderEdit();
    const waiting = renderEdit() as unknown as ReactElement<{ kind: string }>;
    expect(waiting.props.kind).toBe("loading");

    fixture.queries.history = read({ pages: [{ items: [{ id: "movement" }], nextCursor: null }] });
    let screen = renderEdit();
    expect(screen.props.historyLocked).toBe(true);
    screen.props.onDraftChange({
      ...screen.props.draft,
      name: "Coffee beans",
      quantityPrecision: 2,
      tracked: false,
      unitKind: "kilogram",
    });
    screen = renderEdit();
    expect(screen.props.draft).toMatchObject({
      name: "Coffee beans",
      quantityPrecision: 0,
      tracked: true,
      unitKind: "unit",
    });
    screen.props.onReview();
    expect(renderEdit().props.reviewItems).not.toBeNull();
  });

  test("leaves the decision to the server when the history cannot be read", () => {
    fixture.queries.history = {
      ...read(undefined),
      error: new ApiClientError("Unavailable", 503),
      isError: true,
    };
    renderEdit();
    expect(renderEdit().props.historyLocked).toBe(false);
    fixture.queries.history = read({ pages: [{ items: [], nextCursor: null }] });
    expect(renderEdit().props.historyLocked).toBe(false);
  });

  test("treats a balance other than zero as history without reading it", () => {
    fixture.queries.product = read({ product, stock });
    fixture.queries.history = read(undefined);
    renderEdit();
    expect(renderEdit().props.historyLocked).toBe(true);
  });
});

describe("product save refusal", () => {
  const t = ((key: string) => key) as Parameters<typeof productSaveMessage>[3];
  const key = "11111111-1111-4111-8111-111111111111";
  const conflict = new ApiClientError("Conflict", 409, "CONFLICT");
  const active = product as Product;
  const create = {
    idempotencyKey: key,
    categoryId: null,
    lowStockThresholdMinorUnits: null,
    name: "Coffee",
    quantityPrecision: 0,
    sellingPriceMinorUnits: null,
    sku: "CAFE-1",
    tracked: false,
    unitKind: "unit",
  } satisfies ProductCommand;

  test("names the only cause a conflict can have", () => {
    expect(productSaveMessage(conflict, create, undefined, t)).toBe("catalog.form.conflicts.sku");
    expect(productSaveMessage(conflict, { idempotencyKey: key, sku: "CAFE-2" }, active, t)).toBe(
      "catalog.form.conflicts.sku",
    );
    expect(
      productSaveMessage(conflict, { idempotencyKey: key, unitKind: "kilogram" }, active, t),
    ).toBe("catalog.form.conflicts.history");
    expect(productSaveMessage(conflict, { idempotencyKey: key, tracked: false }, active, t)).toBe(
      "catalog.form.conflicts.history",
    );
    expect(
      productSaveMessage(
        conflict,
        { idempotencyKey: key, name: "Beans" },
        { ...active, status: "archived" as const },
        t,
      ),
    ).toBe("catalog.form.conflicts.archived");
  });

  test("keeps the general message when the cause is ambiguous or not a conflict", () => {
    expect(
      productSaveMessage(
        conflict,
        { idempotencyKey: key, quantityPrecision: 2, sku: "CAFE-2" },
        active,
        t,
      ),
    ).toBe("productErrors.contexts.product.conflict");
    expect(
      productSaveMessage(
        new ApiClientError("Forbidden", 403, "FORBIDDEN"),
        { idempotencyKey: key, sku: "CAFE-2" },
        active,
        t,
      ),
    ).toBe("productErrors.contexts.product.forbidden");
  });
});
