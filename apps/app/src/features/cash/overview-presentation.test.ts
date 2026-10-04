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

import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { SelectField } from "@/components/ui/select-field";
import { buildExpensesCopy } from "@/features/expenses/copy";
import { ExpenseFilters } from "@/features/expenses/expense-filters";
import { ExpenseHistory } from "@/features/expenses/expense-history";
import { ExpensesScreen } from "@/features/expenses/expenses-screen";
import { i18n } from "@/i18n/config";
import { elements } from "../../../test-support/element-tree";
import { CashAccountList } from "./cash-account-list";
import { CashMovementList } from "./cash-movement-list";
import { CashScreen } from "./cash-screen";
import { buildCashCopy } from "./copy";

const noop = () => undefined;
const formatMoney = (amount: string, currency: string, digits: number) =>
  `${currency} ${amount} (${digits})`;
const account: CashAccount = {
  id: "account-a",
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
const expenseCopy = buildExpensesCopy(i18n.t);
const cashCopy = buildCashCopy(i18n.t);

function expenseProps(): ComponentProps<typeof ExpensesScreen> {
  return {
    accounts: [account],
    categoryOptions: expenseCopy.categoryOptions,
    copy: expenseCopy.overview("Private business"),
    filters: { accountId: "all", category: "all", status: "posted" },
    period: { startLocalDate: "2026-09-01", endLocalDate: "2026-09-27" },
    state: {
      kind: "ready",
      expenses: [expense],
      summary,
      canManage: true,
      isStale: false,
      confirmation: "idle",
    },
    hasMoreAccounts: true,
    hasMoreExpenses: true,
    isLoadingMoreAccounts: false,
    isLoadingMoreExpenses: false,
    formatMoney,
    onApplyPeriod: vi.fn(),
    onCheckMutationStatus: vi.fn(),
    onFiltersChange: vi.fn(),
    onLoadMoreAccounts: vi.fn(),
    onLoadMoreExpenses: vi.fn(),
    onOpenExpense: vi.fn(),
    onPeriodChange: vi.fn(),
    onRegisterExpense: vi.fn(),
    onRetry: vi.fn(),
    onVoidExpense: vi.fn(),
  };
}
function cashProps(): ComponentProps<typeof CashScreen> {
  return {
    accountStatus: "active",
    copy: cashCopy.overview("Private business"),
    formatMoney,
    state: {
      kind: "ready",
      accounts: [account],
      movements: [movement],
      canManage: true,
      isStale: false,
      confirmation: "idle",
    },
    hasMoreAccounts: true,
    hasMoreMovements: true,
    isLoadingMoreAccounts: false,
    isLoadingMoreMovements: false,
    onAccountStatusChange: vi.fn(),
    onCheckMutationStatus: vi.fn(),
    onCreateAccount: vi.fn(),
    onLoadMoreAccounts: vi.fn(),
    onLoadMoreMovements: vi.fn(),
    onOpenAccount: vi.fn(),
    onRetry: vi.fn(),
  };
}

// Capture the feature's composition while rendering the real shared controls. This lets
// us inspect named sections and call supplied callbacks without replacing their controls.
function capture<P extends object>(Component: (props: P) => ReactElement, props: P) {
  let tree: ReactElement | undefined;
  function Capture() {
    tree = Component(props);
    return tree;
  }
  const markup = renderToStaticMarkup(createElement(Capture));
  if (!tree) throw new Error("The component did not render.");
  return { tree, markup };
}
function section(tree: ReactNode, value: "accounts" | "movements" | "history" | "summary") {
  const labels = {
    accounts: cashCopy.overview("Private business").accountsTitle,
    movements: cashCopy.overview("Private business").movementsTitle,
    history: expenseCopy.overview("Private business").historyTitle,
    summary: i18n.t("filters.periodSummary"),
  };
  const match = elements<ComponentProps<typeof View>>(tree, View).find(
    (element) =>
      element.props.role === "region" && element.props.accessibilityLabel === labels[value],
  );
  if (!match) throw new Error(`Missing section: ${value}`);
  return match;
}

describe("expense and cash overview presentation", () => {
  test("shows history and period totals together with clearly separated controls", () => {
    const props = expenseProps();
    const { tree, markup } = capture(ExpensesScreen, props);
    expect(markup).not.toContain('role="tablist"');
    expect(markup).toContain(expense.description);
    expect(markup).toContain(expense.occurredLocalDate);
    expect(markup).toContain("USD 9007199254740993 (2)");
    expect(markup).toContain(props.copy.applyPeriod);
    expect(markup).toContain("18014398509481986");
    const summaryMarkup = renderToStaticMarkup(section(tree, "summary"));
    expect(summaryMarkup).toContain(props.copy.applyPeriod);
    expect(summaryMarkup).toContain("USD 18014398509481986 (2)");
    expect(summaryMarkup).toContain(props.copy.categories.utilities);
    expect(summaryMarkup).toContain(props.copy.expensesNotProfit);
    expect(summaryMarkup).not.toContain(expense.description);
    expect(summaryMarkup).not.toContain(props.copy.statusFilter);
  });

  test.each(["loading", "error", "offline"] as const)(
    "keeps recovery controls in both views during %s without fake empty results",
    (kind) => {
      const props = expenseProps();
      props.state = { kind, message: "Read unavailable" };
      const { tree, markup } = capture(ExpensesScreen, props);
      expect(markup).toContain(props.copy.statusFilter);
      expect(markup).toContain(props.copy.categoryFilter);
      expect(markup).toContain(props.copy.accountFilter);
      expect(markup).not.toContain(props.copy.emptyTitle);
      expect(markup).not.toContain(expense.description);
      const summaryMarkup = renderToStaticMarkup(section(tree, "summary"));
      expect(summaryMarkup).toContain('value="2026-09-01"');
      expect(summaryMarkup).toContain(props.copy.applyPeriod);
      expect(summaryMarkup).not.toContain("18014398509481986");
      const cash = cashProps();
      cash.state = { kind, message: "Read unavailable" };
      const renderedCash = capture(CashScreen, cash);
      expect(renderedCash.markup).toContain(cash.copy.accountFilter);
      expect(renderedCash.markup).not.toContain(account.name);
      expect(renderToStaticMarkup(section(renderedCash.tree, "movements"))).not.toContain(
        cash.copy.noMovements,
      );
    },
  );

  test("hides cached records, option names, business descriptions, and sections on denial", () => {
    const expenses = expenseProps();
    expenses.state = { ...expenses.state, kind: "denied" };
    const cash = cashProps();
    cash.state = { ...cash.state, kind: "denied" };
    for (const markup of [
      capture(ExpensesScreen, expenses).markup,
      capture(CashScreen, cash).markup,
    ]) {
      expect(markup).not.toContain(account.name);
      expect(markup).not.toContain(expense.description);
      expect(markup).not.toContain("Private business");
      expect(markup).not.toContain("9007199254740993");
      expect(markup).not.toContain('role="tablist"');
    }
  });

  test("forwards date changes only to the period and retains both pagination callbacks", () => {
    const props = expenseProps();
    const { tree } = capture(ExpensesScreen, props);
    const [dates] = elements<ComponentProps<typeof DateRangeFilter>>(
      section(tree, "summary"),
      DateRangeFilter,
    );
    expect(dates).toBeDefined();
    dates?.props.onStartDateChange("2026-08-01");
    dates?.props.onApply();
    expect(props.onPeriodChange).toHaveBeenCalledWith({
      ...props.period,
      startLocalDate: "2026-08-01",
    });
    expect(props.onApplyPeriod).toHaveBeenCalledOnce();
    expect(props.onFiltersChange).not.toHaveBeenCalled();
    const [filters] = elements<ComponentProps<typeof ExpenseFilters>>(
      section(tree, "history"),
      ExpenseFilters,
    );
    expect(filters?.props.onLoadMoreAccounts).toBe(props.onLoadMoreAccounts);
    const loadMore = elements<ComponentProps<typeof Button>>(section(tree, "history"), Button);
    expect(loadMore.some((button) => button.props.onPress === props.onLoadMoreExpenses)).toBe(true);
  });

  test("uses compact selects for category/accounts and preserves status and reset semantics", () => {
    const props = expenseProps();
    const filters = { accountId: account.id, category: "rent" as const, status: "voided" as const };
    const { tree, markup } = capture(ExpenseFilters, {
      accounts: props.accounts,
      categoryOptions: props.categoryOptions,
      copy: props.copy,
      filters,
      hasMoreAccounts: true,
      isLoadingMoreAccounts: true,
      onFiltersChange: props.onFiltersChange,
      onLoadMoreAccounts: props.onLoadMoreAccounts,
    });
    expect(elements(tree, FilterBar)).toHaveLength(1);
    const selects = elements<ComponentProps<typeof SelectField>>(tree, SelectField);
    expect(selects).toHaveLength(2);
    selects
      .find((select) => select.props.label === props.copy.accountFilter)
      ?.props.onChange("all");
    expect(props.onFiltersChange).toHaveBeenCalledWith({ ...filters, accountId: "all" });
    const [toolbar] = elements<ComponentProps<typeof FilterToolbar>>(tree, FilterToolbar);
    toolbar?.props.onReset?.();
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      accountId: "all",
      category: "all",
      status: "posted",
    });
    expect(markup).toContain(props.copy.loadingMore);
    expect(props.onPeriodChange).not.toHaveBeenCalled();
  });

  test("cash filters only the accounts section and retains movement access and pagination", () => {
    const props = cashProps();
    const { tree, markup } = capture(CashScreen, props);
    expect(markup).not.toContain('role="tablist"');
    expect(markup).toContain(movement.occurredLocalTime);
    expect(markup).toContain(account.name);
    expect(markup).toContain(props.copy.negativeAllowed);
    const movements = renderToStaticMarkup(section(tree, "movements"));
    expect(movements).toContain("USD -9007199254740993 (2)");
    expect(movements).toContain(movement.occurredLocalTime);
    expect(movements).not.toContain(props.copy.accountFilter);
    const [accounts] = elements<ComponentProps<typeof CashAccountList>>(
      section(tree, "accounts"),
      CashAccountList,
    );
    expect(accounts?.props.onOpenAccount).toBe(props.onOpenAccount);
    expect(
      elements<ComponentProps<typeof Button>>(section(tree, "accounts"), Button).some(
        (button) => button.props.onPress === props.onLoadMoreAccounts,
      ),
    ).toBe(true);
    expect(
      elements<ComponentProps<typeof Button>>(section(tree, "movements"), Button).some(
        (button) => button.props.onPress === props.onLoadMoreMovements,
      ),
    ).toBe(true);
  });

  test("renders genuine empty states only after successful reads", () => {
    const props = expenseProps();
    if (props.state.kind !== "ready") throw new Error("Expected ready fixture");
    props.state.expenses = [];
    expect(capture(ExpensesScreen, props).markup).toContain(props.copy.emptyTitle);
    const cash = cashProps();
    if (cash.state.kind !== "ready") throw new Error("Expected ready fixture");
    cash.state.accounts = [];
    cash.state.movements = [];
    const { tree, markup } = capture(CashScreen, cash);
    expect(markup).toContain(cash.copy.emptyTitle);
    expect(renderToStaticMarkup(section(tree, "movements"))).toContain(cash.copy.noMovements);
  });

  test.each(["uncertain", "failed"] as const)(
    "keeps %s mutation notices above both sections with their existing callbacks",
    (confirmation) => {
      const props = expenseProps();
      if (props.state.kind !== "ready") throw new Error("Expected ready fixture");
      props.state.confirmation = confirmation;
      props.state.mutationMessage = "Mutation failed detail";
      const cash = cashProps();
      if (cash.state.kind !== "ready") throw new Error("Expected ready fixture");
      cash.state.confirmation = confirmation;
      for (const { tree, markup, copy } of [
        { ...capture(ExpensesScreen, props), copy: props.copy },
        { ...capture(CashScreen, cash), copy: cash.copy },
      ]) {
        expect(markup).toContain(
          confirmation === "uncertain" ? copy.uncertainTitle : copy.mutationFailedTitle,
        );
        expect(elements(tree, Button).length).toBeGreaterThan(0);
        expect(markup).toContain('role="region"');
      }
      if (confirmation === "uncertain") {
        expect(capture(ExpensesScreen, props).markup).not.toContain(props.copy.registerExpense);
        expect(capture(CashScreen, cash).markup).not.toContain(cash.copy.createAccount);
      }
    },
  );

  test("retains expense review navigation, hides void for read-only/voided rows, and renders every loaded row", () => {
    const props = expenseProps();
    const historyProps: ComponentProps<typeof ExpenseHistory> = {
      expenses: Array.from({ length: 51 }, (_, index) => ({
        ...expense,
        id: `expense-${index}`,
        description: `Complete record ${index}`,
      })),
      canManage: false,
      postedLabel: props.copy.posted,
      voidedLabel: props.copy.voided,
      voidActionLabel: props.copy.voidAction,
      categoryLabels: props.copy.categories,
      formatMoney,
      onOpenExpense: props.onOpenExpense,
      onVoidExpense: props.onVoidExpense,
    };
    const markup = renderToStaticMarkup(createElement(ExpenseHistory, historyProps));
    expect(markup).toContain("Complete record 50");
    expect(markup.indexOf("Complete record 0")).toBeLessThan(markup.indexOf("Complete record 50"));
    expect(markup).not.toContain(props.copy.voidAction);
    expect(
      renderToStaticMarkup(
        createElement(ExpenseHistory, {
          ...historyProps,
          canManage: true,
          expenses: [{ ...expense, status: "voided" }],
        }),
      ),
    ).not.toContain(props.copy.voidAction);
    const movementMarkup = renderToStaticMarkup(
      createElement(CashMovementList, {
        actionLabels: cashCopy.overview("Business").movementActions,
        movements: [movement],
        formatMoney,
        noMovements: "No movements",
        onOpenMovement: noop,
      }),
    );
    expect(movementMarkup).toContain(
      i18n.t("dataTable.openRecord", {
        name: cashCopy.overview("Business").movementActions[movement.action],
      }),
    );
  });
});
