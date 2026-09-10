import type { CashMovement } from "@pisto/contracts";
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

import { CashMovementDetailScreen } from "./cash-movement-detail-screen";
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
