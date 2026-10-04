import type { CashAccount, CashMovement } from "@pisto/contracts";
import { Fragment, type ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  effects: [] as (() => void)[],
  params: {} as Record<string, string>,
  queries: {} as Record<string, Record<string, unknown>>,
  queryKeys: [] as (readonly unknown[])[],
  mutation: {
    error: null as unknown,
    isError: false,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    variables: undefined as unknown,
  },
  router: { push: vi.fn(), replace: vi.fn(), setParams: vi.fn() },
  routeLabels: vi.fn(),
  keys: 0,
}));

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#18181b") : "#18181b",
  withUniwind: (component: unknown) => component,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useRef: (initial: unknown) => {
    const index = fixture.refIndex++;
    fixture.refs[index] ??= { current: initial };
    return fixture.refs[index];
  },
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
  useEffect: (effect: () => void) => {
    fixture.effects.push(effect);
  },
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    fixture.queryKeys.push(queryKey);
    return fixture.queries[queryKey[0] === "businesses" ? "businesses" : "account"];
  },
  useInfiniteQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    fixture.queryKeys.push(queryKey);
    return fixture.queries[queryKey.includes("movements") ? "movements" : "accounts"];
  },
  useMutation: () => fixture.mutation,
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
vi.mock("expo-router", () => ({
  Redirect: "redirect",
  useLocalSearchParams: () => fixture.params,
  useRouter: () => fixture.router,
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => `key-${++fixture.keys}` }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("@/components/shell/shell-context", () => ({
  useRouteLabel: fixture.routeLabels,
  useShellTopInset: () => 0,
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn() } }));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { items: { id: string }[]; activeBusinessId: string } | undefined) =>
    data?.items.find(({ id }) => id === data.activeBusinessId),
}));
vi.mock("./api", () => ({ cashApi: { accounts: {}, movements: {} } }));
vi.mock("./invalidate", () => ({ invalidateCashLedger: async () => undefined }));
vi.mock("./cash-screen", () => ({ CashScreen: "cash-screen" }));
vi.mock("./cash-adjustment-screen", () => ({ CashAdjustmentScreen: "adjustment-screen" }));
vi.mock("./cash-transfer-screen", () => ({ CashTransferScreen: "transfer-screen" }));
vi.mock("./cash-account-detail-screen", () => ({ CashAccountDetailScreen: "account-screen" }));
vi.mock("./cash-movement-detail-controller", () => ({ CashMovementDetail: "movement-detail" }));

import { FeatureBoundary } from "@/components/feature-boundary";
import { CashAccountDetailController } from "./cash-account-detail-controller";
import { CashAdjustmentController } from "./cash-adjustment-controller";
import { CashController } from "./cash-controller";
import { CashTransferController } from "./cash-transfer-controller";

type Rendered = ReactElement<Record<string, unknown>>;

function query(data: unknown, changes: Record<string, unknown> = {}) {
  return {
    data,
    error: null,
    fetchStatus: "idle",
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isError: false,
    isFetchingNextPage: false,
    isPending: false,
    refetch: vi.fn(),
    ...changes,
  };
}
const source = {
  id: "requested-source",
  name: "Requested source beyond first page",
  status: "active",
  currency: "USD",
  currencyMinorUnitDigits: 2,
} as CashAccount;
const firstPage = Array.from({ length: 50 }, (_, index) => ({
  ...source,
  id: `page-account-${index}`,
  name: `Page account ${index}`,
}));
const uncertain = new ApiClientError("The response was lost", 502);

function render(component: () => unknown): Rendered {
  fixture.index = 0;
  fixture.refIndex = 0;
  fixture.effects = [];
  const result = component() as Rendered;
  for (const effect of fixture.effects) effect();
  return result;
}
/** Renders twice so effects that seed the draft are visible, like a mounted screen. */
function settle(component: () => unknown): Rendered {
  render(component);
  return render(component);
}
function screenOf(element: Rendered): Rendered {
  if (element.type !== Fragment) return element;
  const [screen] = element.props.children as Rendered[];
  if (!screen) throw new Error("The controller rendered no screen.");
  return screen;
}
function dialogOf(element: Rendered): Rendered | null {
  if (element.type !== Fragment) return null;
  return (element.props.children as (Rendered | null)[])[1] ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.states = [];
  fixture.refs = [];
  fixture.queryKeys = [];
  fixture.keys = 0;
  fixture.params = { accountId: source.id, fromAccountId: source.id };
  Object.assign(fixture.mutation, {
    error: null,
    isError: false,
    isPending: false,
    variables: undefined,
  });
  fixture.queries = {
    businesses: query({
      activeBusinessId: "business",
      items: [
        {
          id: "business",
          timeZone: "UTC",
          currency: "USD",
          currencyMinorUnitDigits: 2,
          access: { permissions: ["cash:read", "cash:manage"] },
        },
      ],
    }),
    accounts: query({ pages: [{ items: firstPage }] }),
    account: query({ account: source }),
    movements: query({ pages: [{ items: [] }] }),
  };
});

describe("cash operations opened from an account", () => {
  test.each([CashAdjustmentController, CashTransferController])(
    "keep the requested source beyond the first 50 choices",
    (controller) => {
      const screen = settle(controller);
      expect(fixture.queryKeys).toContainEqual([
        "cash",
        "business",
        "accounts",
        "detail",
        source.id,
      ]);
      const accounts = screen.props.accounts as CashAccount[];
      expect(accounts).toHaveLength(51);
      expect(accounts.find(({ id }) => id === source.id)).toEqual(source);
      const draft = screen.props.draft as { accountId?: string; fromAccountId?: string };
      expect(draft.accountId ?? draft.fromAccountId).toBe(source.id);
    },
  );

  test.each([CashAdjustmentController, CashTransferController])(
    "refuse to substitute another account for a missing or archived source",
    (controller) => {
      for (const account of [
        query(undefined, { error: new ApiClientError("Missing", 404, "NOT_FOUND"), isError: true }),
        query({ account: { ...source, status: "archived" } }),
      ]) {
        fixture.states = [];
        fixture.queries.account = account;
        const element = settle(controller);
        expect(element.type).toBe(FeatureBoundary);
        expect(element.props.state).toEqual({
          kind: "error",
          message: "cash.remote.requestedAccountUnavailable",
        });
      }
    },
  );

  test("cancelling an adjustment returns to the account it came from", () => {
    (settle(CashAdjustmentController).props.onCancel as () => void)();
    expect(fixture.router.replace).toHaveBeenLastCalledWith({
      pathname: "/operate/cash/accounts/[accountId]",
      params: { accountId: source.id },
    });
    fixture.states = [];
    fixture.params = {};
    (settle(CashAdjustmentController).props.onCancel as () => void)();
    expect(fixture.router.replace).toHaveBeenLastCalledWith("/operate/cash");
    expect(fixture.routeLabels).toHaveBeenCalledWith(
      "/operate/cash/accounts/[accountId]",
      source.name,
    );
  });

  test("cancelling a transfer returns to its source account or to the overview", () => {
    (settle(CashTransferController).props.onCancel as () => void)();
    expect(fixture.router.replace).toHaveBeenLastCalledWith({
      pathname: "/operate/cash/accounts/[accountId]",
      params: { accountId: source.id },
    });
    fixture.states = [];
    fixture.params = {};
    (settle(CashTransferController).props.onCancel as () => void)();
    expect(fixture.router.replace).toHaveBeenLastCalledWith("/operate/cash");
  });

  test("retries an uncertain adjustment with the reviewed command and its key", () => {
    let screen = settle(CashAdjustmentController);
    const onDraftChange = screen.props.onDraftChange as (draft: unknown) => void;
    onDraftChange({ ...(screen.props.draft as object), amount: "12.50", reason: "Conteo" });
    screen = render(CashAdjustmentController);
    (screen.props.onPrepareReview as () => void)();
    screen = render(CashAdjustmentController);
    const command = screen.props.command as { idempotencyKey: string };
    expect(command.idempotencyKey).toBe("key-1");
    (screen.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(command);

    Object.assign(fixture.mutation, { error: uncertain, isError: true, variables: command });
    screen = render(CashAdjustmentController);
    expect(screen.props.phase).toBe("uncertain");
    (screen.props.onEdit as () => void)();
    (screen.props.onCancel as () => void)();
    expect(fixture.router.replace).not.toHaveBeenCalled();
    screen = render(CashAdjustmentController);
    expect(screen.props.command).toBe(command);
    (screen.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(command);

    Object.assign(fixture.mutation, {
      error: new ApiClientError("Rejected", 409, "CONFLICT"),
      isError: true,
    });
    screen = render(CashAdjustmentController);
    (screen.props.onEdit as () => void)();
    screen = render(CashAdjustmentController);
    (screen.props.onPrepareReview as () => void)();
    screen = render(CashAdjustmentController);
    expect((screen.props.command as { idempotencyKey: string }).idempotencyKey).toBe("key-2");
  });
});

describe("access lost during a review", () => {
  test("replaces the open review with the denied state instead of reading its data", () => {
    let screen = settle(CashAdjustmentController);
    (screen.props.onDraftChange as (draft: unknown) => void)({
      ...(screen.props.draft as object),
      amount: "1",
      reason: "Conteo",
    });
    screen = render(CashAdjustmentController);
    (screen.props.onPrepareReview as () => void)();
    expect(render(CashAdjustmentController).props.command).toBeTruthy();
    fixture.queries.businesses = query({
      activeBusinessId: "business",
      items: [{ id: "business", timeZone: "UTC", access: { permissions: ["cash:read"] } }],
    });
    const element = render(CashAdjustmentController);
    expect(element.type).toBe(FeatureBoundary);
    expect(element.props.state).toEqual({ kind: "denied" });
  });
});

describe("account detail", () => {
  const movement = {
    id: "last-row",
    accountId: source.id,
    action: "adjustment_in",
    deltaMinorUnits: "100",
  } as CashMovement;
  function selectMovement() {
    fixture.queries.movements = query({ pages: [{ items: [movement] }] });
    const element = settle(CashAccountDetailController);
    (screenOf(element).props.onOpenMovement as (id: string) => void)(movement.id);
    return render(CashAccountDetailController);
  }

  test("names the account in the breadcrumb once it is read", () => {
    settle(CashAccountDetailController);
    expect(fixture.routeLabels).toHaveBeenCalledWith(
      "/operate/cash/accounts/[accountId]",
      source.name,
    );
  });

  test("keeps the open movement after its row leaves the refreshed page", () => {
    expect(dialogOf(selectMovement())?.props.movement).toBe(movement);
    fixture.queries.movements = query({ pages: [{ items: [] }] });
    const after = render(CashAccountDetailController);
    const dialog = dialogOf(after);
    if (!dialog) throw new Error("The open movement was dropped.");
    expect(dialog.type).toBe("movement-detail");
    expect(dialog.props.movement).toBe(movement);
    (dialog.props.onClose as () => void)();
    expect(dialogOf(render(CashAccountDetailController))).toBeNull();
  });

  test("a paused membership refresh removes manager access from the open movement", () => {
    selectMovement();
    fixture.queries.businesses = { ...fixture.queries.businesses, fetchStatus: "paused" };
    const element = render(CashAccountDetailController);
    expect(dialogOf(element)?.props.canManage).toBe(false);
    expect(screenOf(element).props.isStale).toBe(true);
  });

  test("denial and a different account both drop the open movement", () => {
    selectMovement();
    fixture.queries.movements = query(
      { pages: [{ items: [] }] },
      { isError: true, error: new ApiClientError("Denied", 403, "FORBIDDEN") },
    );
    const denied = render(CashAccountDetailController);
    expect(denied.type).toBe(FeatureBoundary);
    expect(denied.props.state).toEqual({ kind: "denied" });
    fixture.queries.movements = query({ pages: [{ items: [movement] }] });
    fixture.queries.account = query({ account: { ...source, id: "other-account" } });
    fixture.params.accountId = "other-account";
    expect(dialogOf(render(CashAccountDetailController))).toBeNull();
  });

  test("archives with one key per dialog and retries an uncertain archive with it", () => {
    let screen = screenOf(settle(CashAccountDetailController));
    type Archive = { onCancel(): void; onConfirm(): void; onOpen(): void; open: boolean };
    (screen.props.archive as Archive).onOpen();
    screen = screenOf(render(CashAccountDetailController));
    expect((screen.props.archive as Archive).open).toBe(true);
    (screen.props.archive as Archive).onConfirm();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith({ idempotencyKey: "key-1" });

    const sent = { idempotencyKey: "key-1" };
    Object.assign(fixture.mutation, { error: uncertain, isError: true, variables: sent });
    screen = screenOf(render(CashAccountDetailController));
    expect((screen.props.archive as { phase: string }).phase).toBe("uncertain");
    (screen.props.archive as Archive).onConfirm();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
    expect(fixture.keys).toBe(1);
  });
});

describe("cash overview", () => {
  test("reads the account status filter from the route and writes it back", () => {
    fixture.params = { status: "archived" };
    const screen = screenOf(settle(CashController));
    expect(screen.props.accountStatus).toBe("archived");
    expect(fixture.queryKeys).toContainEqual(["cash", "business", "accounts", "list", "archived"]);
    expect(fixture.queryKeys).toContainEqual(["cash", "business", "movements", "list", "all"]);
    const change = screen.props.onAccountStatusChange as (status: string) => void;
    change("active");
    expect(fixture.router.setParams).toHaveBeenLastCalledWith({ status: undefined });
    change("all");
    expect(fixture.router.setParams).toHaveBeenLastCalledWith({ status: "all" });
  });

  test("an unknown status falls back to active accounts", () => {
    fixture.params = { status: "deleted" };
    expect(screenOf(settle(CashController)).props.accountStatus).toBe("active");
  });

  test("a rejected ledger read replaces the whole page", () => {
    fixture.queries.movements = query(undefined, {
      error: new ApiClientError("Denied", 403, "FORBIDDEN"),
      isError: true,
    });
    const element = settle(CashController);
    expect(element.type).toBe(FeatureBoundary);
    expect(element.props.state).toEqual({ kind: "denied" });
  });

  test("stale reads keep the data but withdraw manager actions", () => {
    fixture.queries.accounts = query({ pages: [{ items: firstPage }] }, { isError: true });
    const screen = screenOf(settle(CashController));
    expect(screen.props.isStale).toBe(true);
    expect(screen.props.canManage).toBe(false);
  });
});
