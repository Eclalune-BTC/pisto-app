import type { CashAccount, CashMovement, Expense, ExpensePeriodSummary } from "@pisto/contracts";
import { type ComponentProps, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#18181b") : "#18181b",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
// Account names come from the rows already loaded; nothing here may reach the network.
vi.mock("@/lib/api-client", () => ({}));

import { Section } from "@/components/layout/section";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { SelectField } from "@/components/ui/select-field";
import { ExpenseFilters } from "@/features/expenses/expense-filters";
import { ExpenseHistory } from "@/features/expenses/expense-history";
import { ExpensesScreen } from "@/features/expenses/expenses-screen";
import { i18n } from "@/i18n/config";
import { elements } from "../../../test-support/element-tree";
import { CashAccountList } from "./cash-account-list";
import { CashMovementList } from "./cash-movement-list";
import { CashScreen } from "./cash-screen";
import { LoadMoreButton } from "./load-more-button";

const t = i18n.t;
const formatMoney = (amount: string, currency: string, digits: number) =>
  `${currency} ${amount} (${digits})`;
const account: CashAccount = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Private account with its complete name",
  kind: "cash",
  status: "active",
  allowNegativeBalance: true,
  currency: "USD",
  currencyMinorUnitDigits: 2,
  balanceMinorUnits: "9007199254740993",
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
};
const expense: Expense = {
  id: "expense-a",
  accountId: account.id,
  status: "posted",
  category: "rent",
  amountMinorUnits: "9007199254740993",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  description: "Private expense with its complete description",
  payee: null,
  occurredAt: "2026-08-01T12:00:00Z",
  occurredLocalDate: "2026-08-01",
  occurredLocalTime: "06:00",
  timeZone: "America/El_Salvador",
  voidedAt: null,
  voidReason: null,
  createdAt: "2026-08-01T12:00:00Z",
};
const movement: CashMovement = {
  id: "movement-a",
  accountId: account.id,
  action: "adjustment_out",
  direction: "out",
  amountMinorUnits: "9007199254740993",
  deltaMinorUnits: "-9007199254740993",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: "2026-09-01T12:00:00Z",
  occurredLocalDate: "2026-09-01",
  occurredLocalTime: "06:00",
  timeZone: "America/El_Salvador",
  reason: "Recorded adjustment",
  expenseId: null,
  transferId: null,
  receivablePaymentId: null,
  reversalOfMovementId: null,
  createdAt: "2026-09-01T12:00:00Z",
};
const summary: ExpensePeriodSummary = {
  periodStartLocal: "2026-09-01",
  periodEndLocalInclusive: "2026-09-27",
  periodStartUtc: "2026-09-01T06:00:00Z",
  periodEndUtcExclusive: "2026-09-28T06:00:00Z",
  timeZone: "America/El_Salvador",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  totalMinorUnits: "18014398509481986",
  expenseCount: "2",
  categories: [{ category: "utilities", amountMinorUnits: "18014398509481986", expenseCount: "2" }],
  queriedAt: "2026-09-27T12:00:00Z",
};
const page = () => ({ hasMore: true, loadingMore: false, onLoadMore: vi.fn() });

function cashProps(): ComponentProps<typeof CashScreen> {
  return {
    accountNames: new Map([[account.id, account.name]]),
    accountStatus: "active",
    accounts: [account],
    accountsPage: page(),
    accountsState: { kind: "ready" },
    businessId: "business-a",
    canManage: true,
    formatMoney,
    formatOccurredAt: (entry) => `${entry.occurredLocalDate} ${entry.occurredLocalTime}`,
    isStale: false,
    movements: [movement],
    movementsPage: page(),
    movementsState: { kind: "ready" },
    onAccountStatusChange: vi.fn(),
    onOpenMovement: vi.fn(),
    onRetry: vi.fn(),
  };
}

function expenseProps(): ComponentProps<typeof ExpensesScreen> {
  return {
    accountNames: new Map([[account.id, account.name]]),
    accounts: [account],
    accountsPage: page(),
    businessId: "business-a",
    canManage: true,
    expenses: [expense],
    expensesPage: page(),
    filters: { accountId: "all", category: "all", status: "posted" },
    formatMoney,
    formatOccurredAt: (entry) => entry.occurredLocalDate,
    historyState: { kind: "ready" },
    isStale: false,
    onApplyPeriod: vi.fn(),
    onFiltersChange: vi.fn(),
    onPeriodChange: vi.fn(),
    onRetry: vi.fn(),
    onVoidExpense: vi.fn(),
    period: { startLocalDate: "2026-09-01", endLocalDate: "2026-09-27" },
    summary,
    summaryState: { kind: "ready" },
  };
}

// Capture the feature's own composition while rendering the real shared controls, so named
// sections can be inspected and supplied callbacks called without replacing those controls.
function capture<P extends object>(Component: (props: P) => ReactElement | null, props: P) {
  let tree: ReactElement | null = null;
  function Capture() {
    tree = Component(props);
    return tree;
  }
  const markup = renderToStaticMarkup(createElement(Capture));
  if (!tree) throw new Error("The component did not render.");
  return { tree: tree as ReactElement, markup };
}
function section(tree: ReactNode, title: string) {
  const match = elements<ComponentProps<typeof Section>>(tree, Section).find(
    (element) => element.props.title === title,
  );
  if (!match) throw new Error(`Missing section: ${title}`);
  return match;
}
function column<T>(table: ReactElement, id: string) {
  const columns = (
    table.props as { columns: { id: string; cell: (context: unknown) => ReactElement }[] }
  ).columns;
  const match = columns.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing column: ${id}`);
  return (record: T) => match.cell({ row: { original: record } });
}

describe("cash overview", () => {
  test("filters only the accounts section and opens movements in place", () => {
    const props = cashProps();
    const { tree, markup } = capture(CashScreen, props);
    const accounts = section(tree, t("cash.overview.accountsTitle"));
    const [filter] = elements<ComponentProps<typeof FilterBar>>(accounts, FilterBar);
    expect(filter?.props.value).toBe("active");
    filter?.props.onChange("archived");
    expect(props.onAccountStatusChange).toHaveBeenCalledWith("archived");

    const movements = section(tree, t("cash.overview.movementsTitle"));
    expect(elements(movements, FilterBar)).toHaveLength(0);
    const movementMarkup = renderToStaticMarkup(movements);
    expect(movementMarkup).toContain("USD -9007199254740993 (2)");
    expect(movementMarkup).toContain("2026-09-01 06:00");
    expect(movementMarkup).toContain(account.name);
    expect(markup).toContain(t("cash.negativeAllowed"));

    const { tree: list } = capture(CashMovementList, {
      actionLabels: { adjustment_out: "Ajuste de salida" } as never,
      formatMoney,
      movements: [movement],
      noMovements: "none",
      onOpenMovement: props.onOpenMovement,
    });
    const opener = column<CashMovement>(list, "type")(movement) as ReactElement<{
      onPress: () => void;
    }>;
    opener.props.onPress();
    expect(props.onOpenMovement).toHaveBeenCalledWith(movement.id);
  });

  test("opens accounts by their row and colors only a negative balance", () => {
    const { tree, markup } = capture(CashAccountList, {
      accounts: [account],
      empty: createElement("p", {}, "empty"),
      formatMoney,
    });
    const href = (tree.props as { getRowHref: (record: CashAccount) => unknown }).getRowHref(
      account,
    );
    expect(href).toEqual({
      pathname: "/operate/cash/accounts/[accountId]",
      params: { accountId: account.id },
    });
    expect(markup).not.toContain(t("dataTable.columns.actions"));
    const balance = column<CashAccount>(tree, "balance");
    const className = (record: CashAccount) =>
      (balance(record).props as { className: string }).className;
    expect(className(account)).not.toContain("text-destructive");
    expect(className({ ...account, balanceMinorUnits: "0" })).not.toContain("text-destructive");
    expect(className({ ...account, balanceMinorUnits: "-1" })).toContain("text-destructive");
  });

  test("keeps each section's own recovery while the other section succeeds", () => {
    const props = cashProps();
    props.accountsState = { kind: "error", message: "Accounts unavailable" };
    const { tree } = capture(CashScreen, props);
    const accounts = renderToStaticMarkup(section(tree, t("cash.overview.accountsTitle")));
    expect(accounts).toContain(t("cash.overview.accountsUnavailable"));
    expect(accounts).toContain(t("cash.overview.statusFilter"));
    expect(accounts).not.toContain(account.name);
    expect(accounts).not.toContain(t("cash.overview.emptyTitle.active"));
    expect(renderToStaticMarkup(section(tree, t("cash.overview.movementsTitle")))).toContain(
      "USD -9007199254740993 (2)",
    );

    const loading = cashProps();
    loading.movementsState = { kind: "loading" };
    const rendered = capture(CashScreen, loading);
    const movements = renderToStaticMarkup(
      section(rendered.tree, t("cash.overview.movementsTitle")),
    );
    expect(movements).toContain('aria-busy="true"');
    expect(movements).not.toContain(t("cash.overview.noMovements"));
    expect(rendered.markup).toContain(account.name);
  });

  test("renders empty states only after successful reads", () => {
    const props = cashProps();
    props.accounts = [];
    props.movements = [];
    const { tree, markup } = capture(CashScreen, props);
    expect(markup).toContain(t("cash.overview.emptyTitle.active"));
    expect(renderToStaticMarkup(section(tree, t("cash.overview.movementsTitle")))).toContain(
      t("cash.overview.noMovements"),
    );
    const archived = capture(CashScreen, { ...props, accountStatus: "archived" }).markup;
    expect(archived).toContain(t("cash.overview.emptyTitle.archived"));
    expect(archived).toContain(t("cash.overview.emptyArchivedDescription"));
  });

  test("offers manager actions only to a manager with fresh data", () => {
    const manager = capture(CashScreen, cashProps()).markup;
    for (const action of ["newAccount", "transfer", "adjust"] as const) {
      expect(manager).toContain(t(`cash.overview.${action}`));
    }
    const reader = capture(CashScreen, { ...cashProps(), accounts: [], canManage: false }).markup;
    for (const action of ["newAccount", "transfer", "adjust"] as const) {
      expect(reader).not.toContain(t(`cash.overview.${action}`));
    }
  });

  test("pages each section with its own cursor", () => {
    const props = cashProps();
    const { tree } = capture(CashScreen, props);
    const [accountsPage] = elements<ComponentProps<typeof LoadMoreButton>>(
      section(tree, t("cash.overview.accountsTitle")),
      LoadMoreButton,
    );
    const [movementsPage] = elements<ComponentProps<typeof LoadMoreButton>>(
      section(tree, t("cash.overview.movementsTitle")),
      LoadMoreButton,
    );
    expect(accountsPage?.props.page).toBe(props.accountsPage);
    expect(movementsPage?.props.page).toBe(props.movementsPage);
  });
});

describe("expenses overview", () => {
  test("renders the history while the period summary is still loading", () => {
    const props = expenseProps();
    props.summary = undefined;
    props.summaryState = { kind: "loading" };
    const { tree, markup } = capture(ExpensesScreen, props);
    expect(markup).toContain(expense.description);
    const periodSummary = renderToStaticMarkup(section(tree, t("filters.periodSummary")));
    expect(periodSummary).toContain('aria-busy="true"');
    expect(periodSummary).toContain(t("expenses.summary.apply"));
    expect(periodSummary).not.toContain(t("expenses.summary.total"));
  });

  test("renders the summary while the history read failed", () => {
    const props = expenseProps();
    props.historyState = { kind: "error", message: "History unavailable" };
    const { tree } = capture(ExpensesScreen, props);
    const history = renderToStaticMarkup(section(tree, t("filters.history")));
    expect(history).toContain(t("expenses.overview.historyUnavailable"));
    expect(history).toContain(t("expenses.overview.statusFilter"));
    expect(history).not.toContain(expense.description);
    expect(history).not.toContain(t("expenses.overview.emptyTitle"));
    const periodSummary = renderToStaticMarkup(section(tree, t("filters.periodSummary")));
    expect(periodSummary).toContain("180,143,985,094,819.86");
  });

  test("shows exact period totals apart from the history filters", () => {
    const { tree } = capture(ExpensesScreen, expenseProps());
    const periodSummary = renderToStaticMarkup(section(tree, t("filters.periodSummary")));
    expect(periodSummary).toContain("180,143,985,094,819.86");
    expect(periodSummary).toContain(t("expenses.categories.utilities"));
    expect(periodSummary).toContain(t("expenses.summary.notProfit"));
    expect(periodSummary).not.toContain(expense.description);
    expect(periodSummary).not.toContain(t("expenses.overview.statusFilter"));
  });

  test("changes only the period draft until the range is applied", () => {
    const props = expenseProps();
    const { tree } = capture(ExpensesScreen, props);
    const [dates] = elements<ComponentProps<typeof DateRangeFilter>>(
      section(tree, t("filters.periodSummary")),
      DateRangeFilter,
    );
    dates?.props.onStartDateChange("2026-08-01");
    expect(props.onPeriodChange).toHaveBeenCalledWith({
      ...props.period,
      startLocalDate: "2026-08-01",
    });
    expect(props.onApplyPeriod).not.toHaveBeenCalled();
    dates?.props.onApply();
    expect(props.onApplyPeriod).toHaveBeenCalledOnce();
    expect(props.onFiltersChange).not.toHaveBeenCalled();
  });

  test("filters the history with a status segment, two selects and a reset", () => {
    const props = expenseProps();
    const filters = { accountId: account.id, category: "rent" as const, status: "voided" as const };
    const { tree } = capture(ExpenseFilters, {
      accounts: props.accounts,
      accountsPage: props.accountsPage,
      filters,
      onFiltersChange: props.onFiltersChange,
    });
    expect(elements(tree, FilterBar)).toHaveLength(1);
    const selects = elements<ComponentProps<typeof SelectField>>(tree, SelectField);
    expect(selects).toHaveLength(2);
    selects
      .find((select) => select.props.label === t("expenses.overview.accountFilter"))
      ?.props.onChange("all");
    expect(props.onFiltersChange).toHaveBeenCalledWith({ ...filters, accountId: "all" });
    const [toolbar] = elements<ComponentProps<typeof FilterToolbar>>(tree, FilterToolbar);
    toolbar?.props.onReset?.();
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      accountId: "all",
      category: "all",
      status: "posted",
    });
    const [accountsPage] = elements<ComponentProps<typeof LoadMoreButton>>(tree, LoadMoreButton);
    expect(accountsPage?.props.page).toBe(props.accountsPage);
    const unfiltered = capture(ExpenseFilters, {
      accounts: props.accounts,
      accountsPage: props.accountsPage,
      filters: props.filters,
      onFiltersChange: props.onFiltersChange,
    });
    expect(
      elements<ComponentProps<typeof FilterToolbar>>(unfiltered.tree, FilterToolbar)[0]?.props
        .onReset,
    ).toBeUndefined();
  });

  test("opens expenses by their row and offers void only on posted rows to a manager", () => {
    const props = expenseProps();
    const history = (onVoidExpense?: (expense: Expense) => void) =>
      capture(ExpenseHistory, {
        accountNames: props.accountNames,
        businessId: props.businessId,
        empty: createElement("p", {}, "empty"),
        expenses: Array.from({ length: 51 }, (_, index) => ({
          ...expense,
          id: `expense-${index}`,
          description: `Complete record ${index}`,
        })),
        formatMoney,
        formatOccurredAt: props.formatOccurredAt,
        onVoidExpense,
      });
    const managed = history(props.onVoidExpense);
    expect(managed.markup).toContain("Complete record 50");
    expect(managed.markup.indexOf("Complete record 0")).toBeLessThan(
      managed.markup.indexOf("Complete record 50"),
    );
    expect(managed.markup).toContain(account.name);
    const table = managed.tree.props as {
      getRowHref: (record: Expense) => unknown;
      rowActions?: (record: Expense) => ReactElement | null;
    };
    expect(table.getRowHref(expense)).toEqual({
      pathname: "/operate/expenses/[expenseId]",
      params: { expenseId: expense.id },
    });
    const actions = table.rowActions?.(expense) as ReactElement<{
      actions: { destructive?: boolean; onPress: () => void }[];
    }>;
    expect(actions.props.actions).toHaveLength(1);
    expect(actions.props.actions[0]?.destructive).toBe(true);
    actions.props.actions[0]?.onPress();
    expect(props.onVoidExpense).toHaveBeenCalledWith(expense);
    expect(table.rowActions?.({ ...expense, status: "voided" })).toBeNull();
    const readOnly = history(undefined).tree.props as { rowActions?: unknown };
    expect(readOnly.rowActions).toBeUndefined();
  });

  test("renders an empty history only after a successful read", () => {
    const props = expenseProps();
    props.expenses = [];
    expect(capture(ExpensesScreen, props).markup).toContain(t("expenses.overview.emptyTitle"));
    expect(
      capture(ExpensesScreen, { ...props, historyState: { kind: "loading" } }).markup,
    ).not.toContain(t("expenses.overview.emptyTitle"));
    expect(capture(ExpensesScreen, { ...props, canManage: false }).markup).not.toContain(
      t("expenses.overview.register"),
    );
  });
});
