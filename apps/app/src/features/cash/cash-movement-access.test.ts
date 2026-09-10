import type { CashAccount, CashMovement } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", () => ({ View: "div", Text: "span", ActivityIndicator: "span" }));
vi.mock("@/components/page", () => ({
  Page: ({ children }: { children: React.ReactNode }) => createElement("main", {}, children),
}));
vi.mock("@/components/screen-header", () => ({
  ScreenHeader: ({ title }: { title: string }) => createElement("h1", {}, title),
}));
vi.mock("@/components/remote-state", () => ({
  StaleNotice: () => createElement("p", {}, "stale"),
}));
vi.mock("@/components/ui/field", () => ({ Field: () => createElement("input") }));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    label,
    disabled,
    loading,
  }: {
    label: string;
    disabled?: boolean;
    loading?: boolean;
  }) => createElement("button", { type: "button", disabled: disabled || loading }, label),
}));

import { CashAdjustmentScreen } from "./cash-adjustment-screen";
import { CashMovementDetailScreen } from "./cash-movement-detail-screen";
import { CashTransferScreen } from "./cash-transfer-screen";
import { buildCashCopy } from "./copy";

const copy = buildCashCopy(((key: string) => key) as TFunction).movementDetail;
const movement = {
  id: "movement",
  action: "adjustment_in",
  deltaMinorUnits: "100",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  reason: "Private movement reason",
  occurredLocalDate: "2026-09-10",
  occurredLocalTime: "10:00",
  timeZone: "America/El_Salvador",
} as CashMovement;
const noop = () => undefined;
const props = {
  remoteState: { kind: "ready" } as const,
  movement,
  accountName: "Private account",
  canManage: true,
  canReverse: true,
  stage: "reverse-review" as const,
  reversalDraft: { localDate: "2026-09-10", localTime: "11:00", reason: "Correction" },
  reversalErrors: {},
  reversalCommand: {
    idempotencyKey: "same-key",
    occurredLocalDate: "2026-09-10",
    occurredLocalTime: "11:00",
    reason: "Correction",
  },
  confirmation: "idle" as const,
  isStale: false,
  copy,
  formatMoney: () => "USD 1.00",
  onBeginReversal: noop,
  onReversalDraftChange: noop,
  onPrepareReversalReview: noop,
  onConfirmReversal: noop,
  onEditReversal: noop,
  onCancelReversal: noop,
  onCheckStatus: noop,
  onRetry: noop,
  onBack: noop,
};

describe("cash movement access after a successful cached read", () => {
  test("denial replaces cached details and reversal controls", () => {
    const html = renderToStaticMarkup(
      createElement(CashMovementDetailScreen, { ...props, remoteState: { kind: "denied" } }),
    );
    expect(html).not.toContain("Private account");
    expect(html).not.toContain("USD 1.00");
    expect(html).not.toContain(copy.confirm);
    expect(html).toContain(copy.deniedTitle);
  });

  test.each([
    { canManage: false, isStale: false },
    { canManage: true, isStale: true },
  ])("disables an existing reversal review when access or freshness changes: %j", (access) => {
    const html = renderToStaticMarkup(
      createElement(CashMovementDetailScreen, { ...props, ...access }),
    );
    expect(html).toContain(`<button type="button" disabled="">${copy.confirm}</button>`);
    const uncertain = renderToStaticMarkup(
      createElement(CashMovementDetailScreen, { ...props, ...access, confirmation: "uncertain" }),
    );
    expect(uncertain).toContain(
      `<button type="button" disabled="">${copy.retrySameConfirmation}</button>`,
    );
    expect(uncertain).toContain(`<button type="button" disabled="">${copy.backToAccount}</button>`);
  });
});

describe("cash confirmations retain reviewed accounts across list refetches", () => {
  const account = {
    id: "original-account",
    name: "Reviewed source",
    status: "active",
    currency: "USD",
    currencyMinorUnitDigits: 2,
  } as CashAccount;
  const destination = { ...account, id: "destination-account", name: "Reviewed destination" };
  const allCopy = buildCashCopy(((key: string) => key) as TFunction);
  const common = {
    remoteState: { kind: "ready" } as const,
    canManage: true,
    accounts: [],
    stage: "review" as const,
    errors: {},
    hasMoreAccounts: false,
    isLoadingMoreAccounts: false,
    effect: "Reviewed effect",
    formatMoney: () => "USD 1.00",
    onDraftChange: noop,
    onPrepareReview: noop,
    onConfirm: noop,
    onEdit: noop,
    onCancel: noop,
    onCreateAccount: noop,
    onCheckStatus: noop,
    onRetry: noop,
    onLoadMoreAccounts: noop,
  };
  test.each(["pending", "uncertain"] as const)(
    "adjustment stays in %s review after its account disappears",
    (confirmation) => {
      const html = renderToStaticMarkup(
        createElement(CashAdjustmentScreen, {
          ...common,
          confirmation,
          reviewAccount: account,
          copy: allCopy.adjustment,
          draft: {
            accountId: account.id,
            amount: "1",
            direction: "in",
            reason: "Reason",
            localDate: "2026-09-10",
            localTime: "11:00",
          },
          command: {
            accountId: account.id,
            amountMinorUnits: "100",
            currency: "USD",
            direction: "in",
            reason: "Reason",
            occurredLocalDate: "2026-09-10",
            occurredLocalTime: "11:00",
            idempotencyKey: "original-key",
          },
        }),
      );
      expect(html).toContain(account.name);
      expect(html).not.toContain("<input");
      expect(html).not.toContain(allCopy.adjustment.createAccount);
      if (confirmation === "uncertain") {
        expect(html).toContain(allCopy.adjustment.retrySameConfirmation);
        expect(html).not.toContain(`>${allCopy.adjustment.edit}</button>`);
      } else
        expect(html).toContain(
          `<button type="button" disabled="">${allCopy.adjustment.edit}</button>`,
        );
    },
  );
  test.each(["pending", "uncertain"] as const)(
    "transfer stays in %s review after both accounts disappear",
    (confirmation) => {
      const html = renderToStaticMarkup(
        createElement(CashTransferScreen, {
          ...common,
          confirmation,
          reviewAccounts: [account, destination],
          copy: allCopy.transfer,
          draft: {
            fromAccountId: account.id,
            toAccountId: destination.id,
            amount: "1",
            note: "",
            localDate: "2026-09-10",
            localTime: "11:00",
          },
          command: {
            fromAccountId: account.id,
            toAccountId: destination.id,
            amountMinorUnits: "100",
            currency: "USD",
            occurredLocalDate: "2026-09-10",
            occurredLocalTime: "11:00",
            idempotencyKey: "original-key",
          },
        }),
      );
      expect(html).toContain(account.name);
      expect(html).toContain(destination.name);
      expect(html).not.toContain("<input");
      expect(html).not.toContain(allCopy.transfer.createAccount);
      if (confirmation === "uncertain") {
        expect(html).toContain(allCopy.transfer.retrySameConfirmation);
        expect(html).not.toContain(`>${allCopy.transfer.edit}</button>`);
      } else
        expect(html).toContain(
          `<button type="button" disabled="">${allCopy.transfer.edit}</button>`,
        );
    },
  );
});
