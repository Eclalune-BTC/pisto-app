import type { CashAccount, CashMovement } from "@pisto/contracts";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
  params: {} as Record<string, string>,
  queries: {} as Record<string, unknown>,
  mutation: {
    isPending: false,
    isError: false,
    error: null as unknown,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
  queryOptions: [] as { enabled?: boolean; queryKey: readonly unknown[] }[],
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
  useEffect: (effect: () => void) => {
    fixture.effects.push(effect);
  },
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { enabled?: boolean; queryKey: readonly unknown[] }) => {
    fixture.queryOptions.push(options);
    return fixture.queries[options.queryKey[0] === "businesses" ? "businesses" : "account"];
  },
  useInfiniteQuery: (options: { queryKey: readonly unknown[] }) =>
    fixture.queries[options.queryKey.includes("movements") ? "movements" : "accounts"],
  useMutation: () => fixture.mutation,
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
vi.mock("expo-router", () => ({
  Redirect: "redirect",
  useLocalSearchParams: () => fixture.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "11111111-1111-4111-8111-111111111111" }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { items: { id: string }[]; activeBusinessId: string } | undefined) =>
    data?.items.find(({ id }) => id === data.activeBusinessId),
}));
vi.mock("./api", () => ({
  cashApi: {
    accounts: { get: vi.fn(), archive: vi.fn() },
    movements: { recordAdjustment: vi.fn(), transfer: vi.fn() },
  },
}));
vi.mock("./cash-adjustment-screen", () => ({ CashAdjustmentScreen: "adjustment-screen" }));
vi.mock("./invalidate", () => ({ invalidateCashLedger: async () => undefined }));
vi.mock("./cash-transfer-screen", () => ({ CashTransferScreen: "transfer-screen" }));
vi.mock("./cash-account-detail-screen", () => ({ CashAccountDetailScreen: "account-screen" }));
vi.mock("./cash-movement-detail-controller", () => ({
  CashMovementDetailController: "movement-screen",
}));

import { CashAccountDetailController } from "./cash-account-detail-controller";
import { CashAdjustmentController } from "./cash-adjustment-controller";
import { CashTransferController } from "./cash-transfer-controller";

function query(data: unknown, changes: Record<string, unknown> = {}) {
  return {
    data,
    error: null,
    fetchStatus: "idle",
    isPending: false,
    isError: false,
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
function render<T>(component: () => T): T {
  fixture.index = 0;
  fixture.effects = [];
  const result = component();
  for (const effect of fixture.effects) effect();
  return result;
}
beforeEach(() => {
  fixture.states = [];
  fixture.queryOptions = [];
  fixture.params = { accountId: source.id, fromAccountId: source.id };
  fixture.mutation.isPending = false;
  fixture.mutation.isError = false;
  fixture.mutation.error = null;
  vi.clearAllMocks();
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

describe("cash source deep links", () => {
  test.each([CashAdjustmentController, CashTransferController])(
    "keeps the requested source beyond the first 50 choices",
    (component) => {
      render(component);
      const screen = render(component);
      expect(fixture.queryOptions).toContainEqual(
        expect.objectContaining({
          enabled: true,
          queryKey: ["cash", "business", "accounts", "detail", source.id],
        }),
      );
      expect(screen.props.accounts).toHaveLength(51);
      expect(screen.props.draft.accountId ?? screen.props.draft.fromAccountId).toBe(source.id);
      expect(
        screen.props.accounts.find((account: CashAccount) => account.id === source.id),
      ).toEqual(source);
    },
  );
  test.each([CashAdjustmentController, CashTransferController])(
    "does not substitute another account when the requested source is missing or archived",
    (component) => {
      for (const accountQuery of [
        query(undefined, { error: new ApiClientError("Missing", 404, "NOT_FOUND"), isError: true }),
        query({ account: { ...source, status: "archived" } }),
      ]) {
        fixture.states = [];
        fixture.queries.account = accountQuery;
        render(component);
        const screen = render(component);
        expect(screen.props.draft.accountId ?? screen.props.draft.fromAccountId).toBe(source.id);
        expect(screen.props.remoteState).toEqual({
          kind: "error",
          message: "cash.remote.requestedAccountUnavailable",
        });
        screen.props.onPrepareReview();
        expect(fixture.mutation.mutate).not.toHaveBeenCalled();
      }
    },
  );
});

describe("selected cash movement lifecycle", () => {
  const movement = {
    id: "last-row",
    accountId: source.id,
    action: "adjustment_in",
    deltaMinorUnits: "100",
  } as CashMovement;
  function selectMovement() {
    fixture.queries.movements = query({ pages: [{ items: [movement] }] });
    const accountScreen = render(CashAccountDetailController);
    accountScreen.props.onOpenMovement(movement.id);
    return render(CashAccountDetailController);
  }
  test("retains the mounted reversal after its row falls outside refreshed bounded pages", () => {
    const before = selectMovement();
    fixture.queries.movements = query({ pages: [{ items: [] }] });
    const after = render(CashAccountDetailController);
    expect(after.type).toBe(before.type);
    expect(after.props.movement).toBe(movement);
    after.props.onBack();
    expect(render(CashAccountDetailController).type).not.toBe(before.type);
  });
  test("a paused membership refresh marks the selected movement stale even when ledger reads remain fresh", () => {
    selectMovement();
    fixture.queries.businesses = {
      ...(fixture.queries.businesses as object),
      fetchStatus: "paused",
    };
    const screen = render(CashAccountDetailController);
    expect(screen.props.movement).toBe(movement);
    expect(screen.props.isStale).toBe(true);
  });
  test("keeps current denial and account identity boundaries around the snapshot", () => {
    const selected = selectMovement();
    fixture.queries.movements = query(
      { pages: [{ items: [] }] },
      { isError: true, error: new ApiClientError("Denied", 403, "FORBIDDEN") },
    );
    expect(render(CashAccountDetailController).props.remoteState).toEqual({ kind: "denied" });
    fixture.params.accountId = "other-account";
    expect(render(CashAccountDetailController).type).not.toBe(selected.type);
  });
});
