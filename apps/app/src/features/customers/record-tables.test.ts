import type { Customer, Receivable, ReceivablePayment, Sale } from "@pisto/contracts";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { ReceivableDetailScreen } from "@/features/receivables/receivable-detail-screen";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import { buildSalesHistoryCopy } from "@/features/sales/copy";
import { SalesHistory } from "@/features/sales/sales-history";
import { i18n } from "@/i18n/config";
import { formatMinorUnits } from "@/lib/money";
import { buildCustomersCopy } from "./copy";
import { CustomersScreen } from "./customers-screen";

const noop = () => undefined;
const date = "2026-09-27";
const timestamp = `${date}T18:00:00.000Z`;
const money = (value: string, currency: string, digits: number) =>
  formatMinorUnits(value, currency, digits, "es-SV");
const copy = buildCustomersCopy(i18n.t);
const customer: Customer = {
  id: "customer-a",
  name: "Long customer name that must remain fully readable",
  email: "customer@example.com",
  phone: "+503 2222 3333",
  notes: null,
  status: "archived",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const customerProps: ComponentProps<typeof CustomersScreen> = {
  canManage: false,
  copy: copy.customers.list,
  onCreate: noop,
  onLoadMore: noop,
  onOpenCustomer: noop,
  onRetry: noop,
  onSearchChange: noop,
  onStatusChange: noop,
  searchQuery: "Long",
  status: "all",
  state: { kind: "ready", items: [customer], stale: true, nextCursor: "next", loadingMore: false },
};
const sale: Sale = {
  id: "sale-a",
  status: "posted",
  entryMode: "total_only",
  grossMinorUnits: "1250",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: timestamp,
  occurredLocalDate: date,
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  description: "Full sale description",
  correction: null,
  createdAt: timestamp,
};
const salesProps: ComponentProps<typeof SalesHistory> = {
  copy: buildSalesHistoryCopy(i18n.t),
  filter: "all",
  formatDateTime: (value) => value,
  formatMoney: money,
  formatQueriedAt: (value) => value,
  onCorrectSale: noop,
  onFilterChange: noop,
  onLoadMore: noop,
  onOpenSale: noop,
  onRetry: noop,
  state: {
    kind: "ready",
    items: [sale],
    canCorrect: true,
    hasMore: true,
    loadingMore: true,
    stale: false,
    queriedAt: timestamp,
  },
};
const receivable: Receivable = {
  id: "charge-a",
  customerId: customer.id,
  state: "open",
  originalMinorUnits: "2500",
  paidMinorUnits: "1250",
  outstandingMinorUnits: "1250",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  description: "Full charge description",
  postedDate: date,
  dueDate: null,
  voidedAt: null,
  voidReason: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const payment: ReceivablePayment = {
  id: "payment-a",
  receivableId: receivable.id,
  customerId: customer.id,
  kind: "payment",
  amountMinorUnits: "1250",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: timestamp,
  occurredLocalDate: date,
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  cashAccountId: "cash-a",
  reference: null,
  reversesPaymentId: null,
  createdAt: timestamp,
};
const paymentProps: ComponentProps<typeof ReceivableDetailScreen> = {
  canManage: true,
  cashAccountNameFor: () => "Operating account",
  copy: copy.receivables.list,
  customerActive: true,
  customerName: customer.name,
  formatDate: (value) => value,
  formatMoney: money,
  onApplyPayment: noop,
  onBack: noop,
  onRetry: noop,
  onReversePayment: noop,
  onVoid: noop,
  state: { kind: "ready", receivable, payments: [payment], stale: false },
};

describe("record table presentation", () => {
  test("keeps both customer contacts, full names, stale notice and the real cursor action", () => {
    const markup = renderToStaticMarkup(createElement(CustomersScreen, customerProps));
    expect(markup).toContain(customer.name);
    expect(markup).toContain(customer.email);
    expect(markup).toContain(customer.phone);
    expect(markup).toContain(copy.customers.list.archived);
    expect(markup).toContain(copy.customers.list.stale);
    expect(markup).toContain(copy.customers.list.loadMore);
    expect(markup).toContain('role="listitem"');
    expect(markup).not.toContain(`>${copy.customers.list.create}<`);
  });

  test.each(["loading", "offline", "error"] as const)(
    "retains customer controls during %s",
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(CustomersScreen, { ...customerProps, state: { kind } }),
      );
      expect(markup).toContain('value="Long"');
      expect(markup).toContain(
        `aria-label="${copy.customers.list.filterLabel}: ${copy.customers.list.all}"`,
      );
      expect(markup).not.toContain(customer.email);
      expect(markup).not.toContain(copy.customers.list.emptyTitle);
    },
  );

  test("hides customer identity and filters on denial", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomersScreen, { ...customerProps, state: { kind: "denied" } }),
    );
    expect(markup).toContain(copy.customers.list.deniedTitle);
    expect(markup).not.toContain(customer.name);
    expect(markup).not.toContain('value="Long"');
    expect(markup).not.toContain(`aria-label="${copy.customers.list.filterLabel}`);
  });

  test("retains sale detail, exact amounts, correction and busy cursor names", () => {
    const markup = renderToStaticMarkup(createElement(SalesHistory, salesProps));
    expect(markup).toContain('aria-label="Ver Full sale description"');
    expect(markup).toContain("$12.50");
    expect(markup).toContain(salesProps.copy.correct);
    expect(markup).toContain(salesProps.copy.loadingMore);
    expect(markup).toContain('aria-busy="true"');
  });

  test("does not restore correction or pagination when unavailable in the supplied state", () => {
    const markup = renderToStaticMarkup(
      createElement(SalesHistory, {
        ...salesProps,
        state: {
          kind: "ready",
          items: [sale],
          canCorrect: false,
          hasMore: false,
          loadingMore: false,
          stale: true,
          queriedAt: timestamp,
        },
      }),
    );
    expect(markup).toContain(salesProps.copy.stale);
    expect(markup).not.toContain(`>${salesProps.copy.correct}<`);
    expect(markup).not.toContain(`>${salesProps.copy.loadMore}<`);
  });

  test("hides sales filters on denial and distinguishes a failed read from empty history", () => {
    const denied = renderToStaticMarkup(
      createElement(SalesHistory, { ...salesProps, state: { kind: "denied" } }),
    );
    expect(denied).toContain(salesProps.copy.deniedTitle);
    expect(denied).not.toContain(`aria-label="${salesProps.copy.filterLabel}`);
    const failed = renderToStaticMarkup(
      createElement(SalesHistory, {
        ...salesProps,
        state: { kind: "error", message: "Read failed" },
      }),
    );
    expect(failed).toContain("Read failed");
    expect(failed).toContain(`aria-label="${salesProps.copy.filterLabel}`);
    expect(failed).not.toContain(salesProps.copy.emptyTitle);
  });

  test.each([false, true])(
    "preserves payment reversal eligibility with an existing reversal: %s",
    (reversed) => {
      const payments: ReceivablePayment[] = reversed
        ? [
            payment,
            { ...payment, id: "reversal-a", kind: "reversal", reversesPaymentId: payment.id },
          ]
        : [payment];
      const markup = renderToStaticMarkup(
        createElement(ReceivableDetailScreen, {
          ...paymentProps,
          state: { kind: "ready", receivable, payments, stale: false },
        }),
      );
      expect(markup).toContain("Operating account");
      expect(markup).toContain("$12.50");
      expect(markup.includes(`>${copy.receivables.list.reverse}<`)).toBe(!reversed);
      expect(markup).toContain(copy.receivables.list.applyPayment);
    },
  );

  test("hides cached payment and customer identity on denial", () => {
    const markup = renderToStaticMarkup(
      createElement(ReceivableDetailScreen, { ...paymentProps, state: { kind: "denied" } }),
    );
    expect(markup).toContain(copy.receivables.list.deniedTitle);
    expect(markup).not.toContain(customer.name);
    expect(markup).not.toContain("Operating account");
    expect(markup).not.toContain(copy.receivables.list.reverse);
  });

  test("keeps current business totals separate from a filtered receivable history", () => {
    const markup = renderToStaticMarkup(
      createElement(ReceivablesScreen, {
        canManage: false,
        copy: copy.receivables.list,
        customerNameFor: () => customer.name,
        filter: "open",
        formatDate: (value) => value,
        formatMoney: money,
        onCreate: noop,
        onFilterChange: noop,
        onLoadMore: noop,
        onOpenReceivable: noop,
        onRetry: noop,
        state: {
          kind: "ready",
          items: [receivable],
          loadingMore: false,
          nextCursor: "next",
          stale: false,
          summary: {
            currency: "USD",
            currencyMinorUnitDigits: 2,
            outstandingMinorUnits: "9900",
            overdueMinorUnits: "5000",
            openReceivableCount: "4",
            overdueReceivableCount: "2",
            businessLocalDate: date,
            timeZone: "America/El_Salvador",
            queriedAt: timestamp,
          },
        },
      }),
    );
    expect(markup).toContain("$99.00");
    expect(markup).toContain("$12.50");
    expect(markup).toContain(i18n.t("reports.position.title"));
    expect(markup).toContain(i18n.t("filters.history"));
    expect(markup).toContain(copy.receivables.list.loadMore);
  });
});
