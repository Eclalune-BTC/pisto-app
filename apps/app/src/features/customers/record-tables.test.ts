import type { Customer, Receivable, ReceivablePayment } from "@pisto/contracts";
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
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { ReceivableDetailScreen } from "@/features/receivables/receivable-detail-screen";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import { i18n } from "@/i18n/config";
import { formatLocalDate } from "@/i18n/format";
import { CustomersScreen } from "./customers-screen";

const noop = () => undefined;
const date = "2026-09-27";
const timestamp = `${date}T18:00:00.000Z`;
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
const balance = {
  currency: "USD",
  currencyMinorUnitDigits: 2,
  outstandingMinorUnits: "1250",
  overdueMinorUnits: "0",
  openReceivableCount: "1",
  overdueReceivableCount: "0",
  queriedAt: timestamp,
};
const customerProps: ComponentProps<typeof CustomersScreen> = {
  balanceFor: () => ({ kind: "ready", balance }),
  canCreate: false,
  onLoadMore: noop,
  onRetry: noop,
  onSearchChange: noop,
  onStatusChange: noop,
  query: "Long",
  search: "Long",
  searching: false,
  status: "all",
  state: { kind: "ready", items: [customer], stale: true, nextCursor: "next", loadingMore: false },
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
const detailProps: ComponentProps<typeof ReceivableDetailScreen> = {
  accountNameFor: () => ({ kind: "ready", name: "Operating account" }),
  canManage: true,
  menuTriggerRef: { current: null },
  onRetry: noop,
  onReversePayment: noop,
  onVoid: noop,
  state: {
    kind: "ready",
    customer: { active: true, id: customer.id, name: customer.name },
    payments: [payment],
    receivable,
    stale: false,
  },
  timeZone: "America/El_Salvador",
};
const paymentActions = `aria-label="${i18n.t("receivables.payments.actions")}"`;

describe("record table presentation", () => {
  test("keeps full names, the phone, balances, stale notice and the real cursor", () => {
    const markup = renderToStaticMarkup(createElement(CustomersScreen, customerProps));
    expect(markup).toContain(customer.name);
    expect(markup).toContain(customer.phone);
    // Compact rows keep the phone; the email stays in the wide table and on the record.
    expect(markup).not.toContain(customer.email);
    expect(markup).toContain("$12.50");
    expect(markup).toContain(i18n.t("customers.status.archived"));
    expect(markup).toContain(i18n.t("remote.stale"));
    expect(markup).toContain(i18n.t("common.loadMore"));
    expect(markup).toContain('role="listitem"');
    expect(markup).toContain("/operate/customers/[customerId]");
    expect(markup).not.toContain(`>${i18n.t("customers.list.create")}<`);
  });

  test("never presents an unconfirmed balance as an amount", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomersScreen, {
        ...customerProps,
        balanceFor: () => ({ kind: "unavailable" }) as const,
      }),
    );
    expect(markup).toContain(i18n.t("customers.list.balanceUnavailable"));
    expect(markup).not.toContain("$");
  });

  test.each(["loading", "offline", "error"] as const)(
    "retains customer controls during %s",
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(CustomersScreen, { ...customerProps, state: { kind } }),
      );
      expect(markup).toContain('value="Long"');
      expect(markup).toContain(
        `aria-label="${i18n.t("customers.list.statusFilter")}: ${i18n.t("customers.list.filterAll")}"`,
      );
      expect(markup).not.toContain(customer.email);
      expect(markup).not.toContain(i18n.t("customers.list.emptyTitle"));
    },
  );

  test("hides customer identity and filters on denial", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomersScreen, { ...customerProps, state: { kind: "denied" } }),
    );
    expect(markup).toContain(i18n.t("customers.list.deniedTitle"));
    expect(markup).not.toContain(customer.name);
    expect(markup).not.toContain('value="Long"');
    expect(markup).not.toContain(`aria-label="${i18n.t("customers.list.statusFilter")}`);
  });

  test("keeps creation in the header while the list is loading or failed", () => {
    for (const kind of ["loading", "offline", "error"] as const) {
      const markup = renderToStaticMarkup(
        createElement(CustomersScreen, { ...customerProps, canCreate: true, state: { kind } }),
      );
      expect(markup).toContain(`>${i18n.t("customers.list.create")}<`);
    }
    const denied = renderToStaticMarkup(
      createElement(CustomersScreen, {
        ...customerProps,
        canCreate: true,
        state: { kind: "denied" },
      }),
    );
    expect(denied).not.toContain(`>${i18n.t("customers.list.create")}<`);
  });

  test("marks a search that has not been applied yet as busy", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomersScreen, { ...customerProps, search: "Longer", searching: true }),
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('maxLength="80"');
  });

  test("distinguishes an empty search from a business without customers", () => {
    const search = renderToStaticMarkup(
      createElement(CustomersScreen, {
        ...customerProps,
        canCreate: true,
        state: { kind: "empty", stale: false },
      }),
    );
    expect(search).toContain(i18n.t("customers.list.searchEmptyTitle"));
    expect(search).toContain(`>${i18n.t("relationships.common.clearSearch")}<`);
    expect(search).not.toContain(i18n.t("customers.list.emptyTitle"));
    const first = renderToStaticMarkup(
      createElement(CustomersScreen, {
        ...customerProps,
        canCreate: true,
        query: "",
        search: "",
        state: { kind: "empty", stale: false },
        status: "active",
      }),
    );
    expect(first).toContain(i18n.t("customers.list.emptyTitle"));
    expect(first).toContain(`>${i18n.t("customers.list.create")}<`);
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
          ...detailProps,
          state: { ...detailProps.state, payments } as typeof detailProps.state,
        }),
      );
      expect(markup).toContain("Operating account");
      expect(markup).toContain("$12.50");
      expect(markup.includes(paymentActions)).toBe(!reversed);
      expect(markup.includes(i18n.t("receivables.payments.reversed"))).toBe(reversed);
      expect(markup).toContain(i18n.t("receivables.detail.applyPayment"));
    },
  );

  test("offers no payment or correction without management or to an archived customer", () => {
    const readOnly = renderToStaticMarkup(
      createElement(ReceivableDetailScreen, { ...detailProps, canManage: false }),
    );
    expect(readOnly).not.toContain(paymentActions);
    expect(readOnly).not.toContain(`>${i18n.t("receivables.detail.applyPayment")}<`);
    const archived = renderToStaticMarkup(
      createElement(ReceivableDetailScreen, {
        ...detailProps,
        state: {
          ...detailProps.state,
          customer: { active: false, id: customer.id, name: customer.name },
        } as typeof detailProps.state,
      }),
    );
    expect(archived).not.toContain(`>${i18n.t("receivables.detail.applyPayment")}<`);
    expect(archived).toContain(paymentActions);
  });

  test("hides cached payment and customer identity on denial", () => {
    const markup = renderToStaticMarkup(
      createElement(ReceivableDetailScreen, { ...detailProps, state: { kind: "denied" } }),
    );
    expect(markup).toContain(i18n.t("relationships.access.deniedTitle"));
    expect(markup).not.toContain(customer.name);
    expect(markup).not.toContain("Operating account");
    expect(markup).not.toContain(paymentActions);
  });

  test("keeps current business totals separate from a filtered receivable history", () => {
    const markup = renderToStaticMarkup(
      createElement(ReceivablesScreen, {
        canCreate: false,
        customerFilter: { kind: "ready", name: customer.name } as const,
        customerFilterRef: { current: null },
        customerNameFor: () => ({ kind: "ready", name: customer.name }) as const,
        filters: { customerId: customer.id, state: "open" },
        onChooseCustomer: noop,
        onClearCustomer: noop,
        onClearFilters: noop,
        onLoadMore: noop,
        onRetry: noop,
        onStateChange: noop,
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
    expect(markup).toContain("$50.00");
    // A compact record leads with what is still owed, not with the original amount.
    expect(markup).toContain("$12.50");
    expect(markup).not.toContain("$25.00");
    expect(markup).toContain(
      i18n.t("receivables.summary.position", { date: formatLocalDate(date, "es-SV") }),
    );
    // Filtered to one customer and one state, rows name the charge and repeat neither.
    expect(markup).toContain(receivable.description);
    expect(markup).not.toContain(`>${i18n.t("receivables.states.open")}<`);
    expect(markup).toContain(`aria-label="${i18n.t("receivables.list.clearCustomer")}"`);
    expect(markup).toContain(i18n.t("common.loadMore"));
    expect(markup).not.toContain(`>${i18n.t("receivables.list.create")}<`);
  });

  test("offers clearing filters when a filtered history is empty", () => {
    const markup = renderToStaticMarkup(
      createElement(ReceivablesScreen, {
        canCreate: true,
        customerFilter: null,
        customerFilterRef: { current: null },
        customerNameFor: () => ({ kind: "unavailable" }) as const,
        filters: { state: "voided" },
        onChooseCustomer: noop,
        onClearCustomer: noop,
        onClearFilters: noop,
        onLoadMore: noop,
        onRetry: noop,
        onStateChange: noop,
        state: {
          kind: "empty",
          stale: false,
          summary: {
            currency: "USD",
            currencyMinorUnitDigits: 2,
            outstandingMinorUnits: "0",
            overdueMinorUnits: "0",
            openReceivableCount: "0",
            overdueReceivableCount: "0",
            businessLocalDate: date,
            timeZone: "America/El_Salvador",
            queriedAt: timestamp,
          },
        },
      }),
    );
    expect(markup).toContain(i18n.t("receivables.list.filteredEmptyTitle"));
    expect(markup).toContain(i18n.t("receivables.list.clearFilters"));
    expect(markup).not.toContain(i18n.t("receivables.list.emptyTitle"));
  });
});
