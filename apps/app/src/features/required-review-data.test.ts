import type { CashAccount } from "@pisto/contracts";
import type { ComponentProps, ReactElement } from "react";
import { createElement } from "react";

// These tests exercise review invariants, not the interactive draft selector.
vi.mock("@/components/ui/select-field", () => ({ SelectField: () => null }));

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#62626B") : "#62626B",
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { i18n } from "@/i18n/config";
import { CashAccountEditorScreen } from "./cash/cash-account-editor-screen";
import { CashAdjustmentScreen } from "./cash/cash-adjustment-screen";
import { CashTransferScreen } from "./cash/cash-transfer-screen";
import { buildCashAdjustmentCommand, buildCashTransferCommand } from "./cash/drafts";
import { buildExpenseCommand } from "./expenses/drafts";
import { ExpenseEditorScreen } from "./expenses/expense-editor-screen";

const noop = () => undefined;
const reviewed = {
  id: "account",
  name: "Original reviewed account",
  status: "active",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  allowNegativeBalance: false,
  balanceMinorUnits: "100000",
} as CashAccount;
const common = {
  accounts: [],
  accountsPage: { hasMore: false, loadingMore: false, onLoadMore: noop },
  canConfirm: true,
  errors: {},
  formatMoney: () => "$12.50",
  onCancel: noop,
  onConfirm: noop,
  onDraftChange: noop,
  onEdit: noop,
  onPrepareReview: noop,
  phase: "idle" as const,
};

function render<P extends object>(Screen: (props: P) => ReactElement, props: P) {
  return renderToStaticMarkup(createElement(Screen, props));
}

describe("required review data", () => {
  test("does not switch a malformed review back to editable input", () => {
    const occurrence = { occurredLocalDate: "2026-09-01", occurredLocalTime: "12:00" };
    expect(() =>
      render(CashAdjustmentScreen, {
        ...common,
        command: {
          ...occurrence,
          accountId: "account",
          amountMinorUnits: "1",
          currency: "USD",
          direction: "in",
          idempotencyKey: "key",
          reason: "Count",
        },
        draft: {} as never,
        reviewAccount: null,
      }),
    ).toThrow("requires its reviewed account");
    expect(() =>
      render(CashTransferScreen, {
        ...common,
        command: {
          ...occurrence,
          amountMinorUnits: "1",
          currency: "USD",
          fromAccountId: "account",
          idempotencyKey: "key",
          toAccountId: "other",
        },
        draft: {} as never,
        reviewAccounts: [reviewed],
      }),
    ).toThrow("requires both reviewed accounts");
    expect(() =>
      render(CashAccountEditorScreen, {
        ...common,
        account: null,
        command: { idempotencyKey: "key", name: "Renamed" },
        currency: "USD",
        draft: {} as never,
      }),
    ).toThrow("requires its original account");
  });

  test("keeps the reviewed expense account when refreshed options no longer include it", () => {
    const props: ComponentProps<typeof ExpenseEditorScreen> = {
      ...common,
      phase: "uncertain",
      reviewAccount: reviewed,
      command: {
        accountId: "account",
        category: "other",
        amountMinorUnits: "1250",
        currency: "USD",
        description: "Supplies",
        occurredLocalDate: "2026-09-01",
        occurredLocalTime: "12:00",
        idempotencyKey: "review-key",
      },
      draft: {
        accountId: "account",
        category: "other",
        amount: "12.50",
        description: "Supplies",
        payee: "",
        localDate: "2026-09-01",
        localTime: "12:00",
      },
    };
    const markup = renderToStaticMarkup(createElement(ExpenseEditorScreen, props));
    expect(markup).toContain("Original reviewed account");
    expect(markup).toContain("$12.50");
    expect(markup).toContain(i18n.t("common.retrySameConfirmation"));
    expect(markup).not.toContain(i18n.t("expenses.editor.noAccountsTitle"));
    expect(() => render(ExpenseEditorScreen, { ...props, reviewAccount: null })).toThrow(
      "requires its reviewed paying account",
    );
  });

  test("reviews the translated account kind instead of its internal identifier", () => {
    const markup = renderToStaticMarkup(
      createElement(CashAccountEditorScreen, {
        ...common,
        account: null,
        command: {
          allowNegativeBalance: false,
          currency: "USD",
          idempotencyKey: "key",
          kind: "bank",
          name: "Account",
          opening: null,
        },
        currency: "USD",
        draft: {} as never,
      }),
    );
    expect(markup).toContain(i18n.t("cash.accountKinds.bank"));
    expect(markup).not.toContain(">bank<");
  });

  test("does not parse money using an invented two-decimal account", () => {
    const draft = {
      amount: "0.001",
      localDate: "2026-09-01",
      localTime: "12:00",
      reason: "Adjustment",
    };
    expect(
      buildCashAdjustmentCommand({
        account: undefined,
        draft: { ...draft, direction: "in", accountId: "" },
        idempotencyKey: "key",
      }).issues,
    ).toEqual({ accountId: "account-required" });
    expect(
      buildCashTransferCommand({
        accounts: [],
        draft: { ...draft, fromAccountId: "", toAccountId: "", note: "" },
        idempotencyKey: "key",
      }).issues,
    ).toEqual({ fromAccountId: "account-required", toAccountId: "account-required" });
    expect(
      buildExpenseCommand({
        accounts: [],
        draft: { ...draft, accountId: "", description: "Supplies", category: "other", payee: "" },
        idempotencyKey: "key",
      }).issues,
    ).toEqual({ accountId: "account-required" });
  });
});
