import type { ComponentProps } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { i18n } from "@/i18n/config";
import { CashAccountEditorScreen } from "./cash/cash-account-editor-screen";
import { CashAdjustmentScreen } from "./cash/cash-adjustment-screen";
import { CashTransferScreen } from "./cash/cash-transfer-screen";
import { buildCashCopy } from "./cash/copy";
import { buildCashAdjustmentCommand, buildCashTransferCommand } from "./cash/drafts";
import { buildExpensesCopy } from "./expenses/copy";
import { buildExpenseCommand } from "./expenses/drafts";
import { ExpenseEditorScreen } from "./expenses/expense-editor-screen";

describe("required review data", () => {
  test("shows denied access before inspecting unavailable review data", () => {
    const copy = buildCashCopy(i18n.t).adjustment;
    const markup = renderToStaticMarkup(
      createElement(CashAdjustmentScreen, {
        remoteState: { kind: "denied" },
        canManage: false,
        stage: "review",
        command: null,
        copy,
        onRetry: vi.fn(),
      } as never),
    );
    expect(markup).toContain(copy.deniedTitle);
  });
  test("does not switch a malformed review back to editable input", () => {
    expect(() =>
      CashAdjustmentScreen({
        stage: "review",
        command: null,
        reviewAccount: null,
        remoteState: { kind: "ready" },
        canManage: true,
        accounts: [],
        draft: {},
      } as never),
    ).toThrow("review is missing");
    expect(() =>
      CashTransferScreen({
        stage: "review",
        command: null,
        reviewAccounts: [],
        remoteState: { kind: "ready" },
        canManage: true,
        accounts: [],
      } as never),
    ).toThrow("review is missing");
    expect(() =>
      CashAccountEditorScreen({
        stage: "review",
        command: null,
        remoteState: { kind: "ready" },
        canManage: true,
      } as never),
    ).toThrow("review requires");
  });

  test("keeps the reviewed expense account when refreshed options no longer include it", () => {
    const copy = buildExpensesCopy(i18n.t);
    const props: ComponentProps<typeof ExpenseEditorScreen> = {
      remoteState: { kind: "ready" },
      canManage: true,
      stage: "review",
      accounts: [],
      reviewAccount: { id: "account", name: "Original reviewed account" },
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
      categoryOptions: copy.categoryOptions,
      copy: copy.editor,
      confirmation: "uncertain",
      effect: copy.effects.create,
      formatMoney: () => "$12.50",
      currency: "USD",
      hasMoreAccounts: false,
      isLoadingMoreAccounts: false,
      onDraftChange: vi.fn(),
      onPrepareReview: vi.fn(),
      onConfirm: vi.fn(),
      onEdit: vi.fn(),
      onCheckStatus: vi.fn(),
      onCreateAccount: vi.fn(),
      onRetry: vi.fn(),
      onLoadMoreAccounts: vi.fn(),
      draft: {
        accountId: "account",
        category: "other",
        amount: "12.50",
        description: "Supplies",
        payee: "",
        localDate: "2026-09-01",
        localTime: "12:00",
      },
      errors: {},
    };
    const markup = renderToStaticMarkup(createElement(ExpenseEditorScreen, props));
    expect(markup).toContain("Original reviewed account");
    expect(markup).toContain("$12.50");
    expect(markup).not.toContain(copy.editor.accountsEmptyTitle);
    expect(() => ExpenseEditorScreen({ ...props, reviewAccount: null })).toThrow(
      "review is missing",
    );
  });

  test("requires a translated account kind instead of displaying its internal identifier", () => {
    expect(() =>
      CashAccountEditorScreen({
        stage: "review",
        remoteState: { kind: "ready" },
        canManage: true,
        command: {
          currency: "USD",
          name: "Account",
          kind: "bank",
          allowNegativeBalance: false,
          opening: null,
        },
        kindOptions: [],
        copy: buildCashCopy(i18n.t).accountEditor,
      } as never),
    ).toThrow("no translated option");
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
