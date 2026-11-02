import type { CashAccount, Expense } from "@pisto/contracts";
import { Fragment, type ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
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
  mutationOptions: undefined as
    | {
        onSuccess: (
          result: { expense: { id: string } },
          variables: { idempotencyKey: string },
        ) => Promise<void>;
      }
    | undefined,
  router: { push: vi.fn(), replace: vi.fn(), setParams: vi.fn() },
  routeLabels: vi.fn(),
  notify: vi.fn(),
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
function queryName(queryKey: readonly unknown[]) {
  if (queryKey[0] === "businesses") return "businesses";
  if (queryKey[0] === "cash") return queryKey.includes("detail") ? "account" : "accounts";
  return queryKey[2] === "summary" ? "summary" : queryKey[2] === "list" ? "expenses" : "expense";
}
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    fixture.queryKeys.push(queryKey);
    return fixture.queries[queryName(queryKey)];
  },
  useInfiniteQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    fixture.queryKeys.push(queryKey);
    return fixture.queries[queryName(queryKey)];
  },
  useMutation: (options: typeof fixture.mutationOptions) => {
    fixture.mutationOptions = options;
    return fixture.mutation;
  },
  useQueryClient: () => ({}),
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
vi.mock("@/lib/notify", () => ({ notify: { success: fixture.notify } }));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { items: { id: string }[]; activeBusinessId: string } | undefined) =>
    data?.items.find(({ id }) => id === data.activeBusinessId),
}));
vi.mock("../cash/api", () => ({ cashApi: { expenses: { post: vi.fn() } } }));
vi.mock("../cash/invalidate", () => ({ invalidateExpensesAndCash: async () => undefined }));
vi.mock("./expenses-screen", () => ({ ExpensesScreen: "expenses-screen" }));
vi.mock("./expense-detail-screen", () => ({ ExpenseDetailScreen: "detail-screen" }));
vi.mock("./expense-editor-screen", () => ({ ExpenseEditorScreen: "editor-screen" }));
vi.mock("./expense-void-dialog", () => ({ ExpenseVoidDialog: "void-dialog" }));

import { FeatureBoundary } from "@/components/feature-boundary";
import { ExpenseDetailController } from "./expense-detail-controller";
import { ExpenseForm } from "./expense-form";
import { ExpensesController } from "./expenses-controller";

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
const account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Caja",
  status: "active",
  allowNegativeBalance: false,
  balanceMinorUnits: "100000",
  currency: "USD",
  currencyMinorUnitDigits: 2,
} as CashAccount;
const expense = {
  id: "expense-a",
  accountId: account.id,
  description: "Energía eléctrica",
  status: "posted",
} as Expense;

function render(component: () => unknown): Rendered {
  fixture.index = 0;
  fixture.effects = [];
  const result = component() as Rendered;
  for (const effect of fixture.effects) effect();
  return result;
}
function parts(element: Rendered): [Rendered, Rendered | null] {
  if (element.type !== Fragment) return [element, null];
  const [screen, dialog] = element.props.children as [Rendered, Rendered | null];
  return [screen, dialog];
}
function setPermissions(permissions: string[]) {
  fixture.queries.businesses = query({
    activeBusinessId: "business",
    items: [
      {
        id: "business",
        timeZone: "America/El_Salvador",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        access: { permissions },
      },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.states = [];
  fixture.queryKeys = [];
  fixture.keys = 0;
  fixture.params = {};
  Object.assign(fixture.mutation, {
    error: null,
    isError: false,
    isPending: false,
    variables: undefined,
  });
  setPermissions(["expenses:read", "expenses:manage", "cash:read", "cash:manage"]);
  fixture.queries.accounts = query({ pages: [{ items: [account] }] });
  fixture.queries.account = query({ account });
  fixture.queries.expenses = query({ pages: [{ items: [expense] }] });
  fixture.queries.summary = query({ summary: { categories: [] } });
  fixture.queries.expense = query({ expense });
});

describe("expenses overview", () => {
  test("reads history filters and the period from the route and queries exactly them", () => {
    fixture.params = {
      account: account.id,
      category: "rent",
      end: "2026-08-31",
      start: "2026-08-01",
      status: "voided",
    };
    const [screen] = parts(render(ExpensesController));
    expect(screen.props.filters).toEqual({
      accountId: account.id,
      category: "rent",
      status: "voided",
    });
    expect(screen.props.period).toEqual({
      startLocalDate: "2026-08-01",
      endLocalDate: "2026-08-31",
    });
    expect(fixture.queryKeys).toContainEqual([
      "expenses",
      "business",
      "list",
      { accountId: account.id, category: "rent", status: "voided" },
    ]);
    expect(fixture.queryKeys).toContainEqual([
      "expenses",
      "business",
      "summary",
      "2026-08-01",
      "2026-08-31",
    ]);
  });

  test("offers an account filter from the route beyond the first page of choices", () => {
    const distant = { ...account, id: "22222222-2222-4222-8222-222222222222", name: "Banco" };
    fixture.params = { account: distant.id };
    fixture.queries.account = query({ account: distant });
    const [screen] = parts(render(ExpensesController));
    expect(fixture.queryKeys).toContainEqual([
      "cash",
      "business",
      "accounts",
      "detail",
      distant.id,
    ]);
    expect(screen.props.accounts).toEqual([distant, account]);
  });

  test("writes filter changes to the route without default values", () => {
    const [screen] = parts(render(ExpensesController));
    (screen.props.onFiltersChange as (filters: unknown) => void)({
      accountId: "all",
      category: "tax",
      status: "posted",
    });
    expect(fixture.router.setParams).toHaveBeenCalledWith({
      account: undefined,
      category: "tax",
      status: undefined,
    });
  });

  test("applies a period only when the dates are valid", () => {
    let [screen] = parts(render(ExpensesController));
    const period = screen.props.period as { startLocalDate: string; endLocalDate: string };
    (screen.props.onPeriodChange as (period: unknown) => void)({
      ...period,
      startLocalDate: "2026-12-31",
    });
    [screen] = parts(render(ExpensesController));
    expect((screen.props.period as typeof period).startLocalDate).toBe("2026-12-31");
    (screen.props.onApplyPeriod as () => void)();
    [screen] = parts(render(ExpensesController));
    expect(screen.props.periodError).toBe("expenses.remote.invalidPeriod");
    expect(fixture.router.setParams).not.toHaveBeenCalled();
    (screen.props.onPeriodChange as (period: unknown) => void)({
      startLocalDate: "2026-08-01",
      endLocalDate: "2026-08-15",
    });
    [screen] = parts(render(ExpensesController));
    (screen.props.onApplyPeriod as () => void)();
    expect(fixture.router.setParams).toHaveBeenCalledWith({
      end: "2026-08-15",
      start: "2026-08-01",
    });
    [screen] = parts(render(ExpensesController));
    expect(screen.props.periodError).toBeUndefined();
  });

  test("renders the history while the period summary is still loading", () => {
    fixture.queries.summary = query(undefined, { isPending: true, fetchStatus: "fetching" });
    const [screen] = parts(render(ExpensesController));
    expect(screen.props.summaryState).toEqual({ kind: "loading" });
    expect(screen.props.historyState).toEqual({ kind: "ready" });
    expect(screen.props.expenses).toEqual([expense]);
  });

  test("keeps the history when only the summary failed", () => {
    fixture.queries.summary = query(undefined, {
      error: new ApiClientError("down", 500),
      isError: true,
    });
    const [screen] = parts(render(ExpensesController));
    expect(screen.props.summaryState).toEqual({
      kind: "error",
      message: "expenses.remote.unavailable",
    });
    expect(screen.props.historyState).toEqual({ kind: "ready" });
  });

  test("an access rejection from any read replaces the page", () => {
    fixture.queries.summary = query(undefined, {
      error: new ApiClientError("Denied", 403, "FORBIDDEN"),
      isError: true,
    });
    const element = render(ExpensesController);
    expect(element.type).toBe(FeatureBoundary);
    expect(element.props.state).toEqual({ kind: "denied" });
  });

  test("registering and voiding need expense and cash management on fresh data", () => {
    expect(parts(render(ExpensesController))[0].props.canManage).toBe(true);
    setPermissions(["expenses:read", "expenses:manage", "cash:read"]);
    expect(parts(render(ExpensesController))[0].props.canManage).toBe(false);
    setPermissions(["expenses:read", "expenses:manage", "cash:read", "cash:manage"]);
    fixture.queries.expenses = query({ pages: [{ items: [expense] }] }, { fetchStatus: "paused" });
    expect(parts(render(ExpensesController))[0].props.canManage).toBe(false);
  });

  test("voids a row through a dialog that keeps the row it was opened for", () => {
    const [screen] = parts(render(ExpensesController));
    (screen.props.onVoidExpense as (expense: Expense) => void)(expense);
    fixture.queries.expenses = query({ pages: [{ items: [] }] });
    const [, dialog] = parts(render(ExpensesController));
    if (!dialog) throw new Error("The void dialog did not open.");
    expect(dialog.type).toBe("void-dialog");
    expect(dialog.props.expense).toBe(expense);
    expect(dialog.props.linkToRecord).toBe(true);
    (dialog.props.onClose as () => void)();
    expect(parts(render(ExpensesController))[1]).toBeNull();
  });
});

describe("expense detail", () => {
  beforeEach(() => {
    fixture.params = { expenseId: expense.id };
  });

  test("names the expense and voids the version that was on screen", () => {
    const [screen] = parts(render(ExpenseDetailController));
    expect(fixture.routeLabels).toHaveBeenCalledWith(
      "/operate/expenses/[expenseId]",
      expense.description,
    );
    expect(screen.props.canVoid).toBe(true);
    (screen.props.onVoid as () => void)();
    fixture.queries.expense = query({ expense: { ...expense, description: "Refetched" } });
    const [, dialog] = parts(render(ExpenseDetailController));
    expect(dialog?.props.expense).toBe(expense);
    expect(dialog?.props.linkToRecord).toBeUndefined();
  });

  test("voiding needs cash management on fresh data", () => {
    setPermissions(["expenses:read", "expenses:manage", "cash:read"]);
    expect(parts(render(ExpenseDetailController))[0].props.canVoid).toBe(false);
    setPermissions(["expenses:read", "expenses:manage", "cash:read", "cash:manage"]);
    fixture.queries.expense = query({ expense }, { fetchStatus: "paused" });
    expect(parts(render(ExpenseDetailController))[0].props.canVoid).toBe(false);
  });

  test.each(["expense", "account"])("a rejected %s read replaces the page", (name) => {
    fixture.queries[name] = query(undefined, {
      error: new ApiClientError("Denied", 403, "FORBIDDEN"),
      isError: true,
    });
    const element = render(ExpenseDetailController);
    expect(element.type).toBe(FeatureBoundary);
    expect(element.props.state).toEqual({ kind: "denied" });
  });

  test("a missing expense is reported as not found, not as an outage", () => {
    fixture.queries.expense = query(undefined, {
      error: new ApiClientError("Missing", 404, "NOT_FOUND"),
      isError: true,
    });
    const element = render(ExpenseDetailController);
    expect(JSON.stringify(element.props)).toContain("expenses.detail.notFoundTitle");
  });
});

const formCallbacks = { onCancel: vi.fn(), onSaved: vi.fn() };
const ExpenseEditorController = () => ExpenseForm({ entrySource: "manual", ...formCallbacks });

describe("expense registration", () => {
  test("reviews once, confirms the reviewed command and reports the new record", async () => {
    render(ExpenseEditorController);
    let screen = render(ExpenseEditorController);
    expect((screen.props.draft as { accountId: string }).accountId).toBe(account.id);
    (screen.props.onDraftChange as (draft: unknown) => void)({
      ...(screen.props.draft as object),
      amount: "14.75",
      description: "Energía eléctrica",
    });
    screen = render(ExpenseEditorController);
    (screen.props.onPrepareReview as () => void)();
    screen = render(ExpenseEditorController);
    const command = screen.props.command as { idempotencyKey: string };
    expect(command).toMatchObject({ amountMinorUnits: "1475", idempotencyKey: "key-1" });
    expect(screen.props.reviewAccount).toBe(account);
    (screen.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenCalledWith(command);
    await fixture.mutationOptions?.onSuccess(
      { expense: { id: "expense-new" } },
      { idempotencyKey: "sent-key" },
    );
    expect(fixture.notify).toHaveBeenCalledWith("expenses.editor.success");
    expect(formCallbacks.onSaved).toHaveBeenCalledWith("expense-new");
  });

  test("pre-fills what the assistant resolved, including the amount in business digits", () => {
    const draft = {
      kind: "expense" as const,
      occurredLocalDate: "2026-10-07",
      occurredLocalTime: "09:30",
      category: "transport" as const,
      amountMinorUnits: "2500",
      description: "Flete de mercadería",
      payee: null,
      account: { id: account.id, name: account.name },
    };
    const Form = () => ExpenseForm({ draft, entrySource: "voice", ...formCallbacks });
    render(Form);
    const screen = render(Form);
    expect(screen.props.draft).toEqual({
      accountId: account.id,
      amount: "25.00",
      category: "transport",
      description: "Flete de mercadería",
      localDate: "2026-10-07",
      localTime: "09:30",
      payee: "",
    });
  });

  test("an empty amount asks for the amount of the expense", () => {
    render(ExpenseEditorController);
    let screen = render(ExpenseEditorController);
    (screen.props.onDraftChange as (draft: unknown) => void)({
      ...(screen.props.draft as object),
      description: "Energía eléctrica",
    });
    screen = render(ExpenseEditorController);
    (screen.props.onPrepareReview as () => void)();
    screen = render(ExpenseEditorController);
    expect(screen.props.command).toBeNull();
    expect(screen.props.errors).toEqual({ amount: "expenses.editor.amountRequired" });
  });

  test("registering needs expense and cash management", () => {
    setPermissions(["expenses:read", "expenses:manage", "cash:read"]);
    const element = render(ExpenseEditorController);
    expect(element.type).toBe(FeatureBoundary);
    expect(element.props.state).toEqual({ kind: "denied" });
  });

  test("cancelling leaves the form unless a confirmation is unresolved", () => {
    render(ExpenseEditorController);
    (render(ExpenseEditorController).props.onCancel as () => void)();
    expect(formCallbacks.onCancel).toHaveBeenCalledTimes(1);
    formCallbacks.onCancel.mockClear();
    Object.assign(fixture.mutation, { error: new ApiClientError("lost", 0), isError: true });
    (render(ExpenseEditorController).props.onCancel as () => void)();
    expect(formCallbacks.onCancel).not.toHaveBeenCalled();
  });
});
