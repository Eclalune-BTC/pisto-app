import type {
  ArchiveCustomerRequest,
  CustomerDetail,
  Receivable,
  ReceivablesSummary,
  VoidReceivableRequest,
} from "@pisto/contracts";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "50000000-0000-4000-8000-000000000001" }));
const captured = vi.hoisted(() => ({
  dialog: {} as Record<string, unknown> & { children?: ReactNode; onConfirm?: () => void },
  stats: [] as { label: string; tone?: string; value: string }[],
}));
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: typeof captured.dialog) => {
    captured.dialog = props;
    return null;
  },
}));
vi.mock("@/components/layout/stat-group", () => ({
  StatGroup: ({ children }: { children: ReactNode }) => children,
  Stat: (props: (typeof captured.stats)[number]) => {
    captured.stats.push(props);
    return null;
  },
}));

import { Field } from "@/components/ui/field";
import { ReceivableDetailScreen } from "@/features/receivables/receivable-detail-screen";
import { ReceivableVoidDialog } from "@/features/receivables/receivable-void-dialog";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import { i18n } from "@/i18n/config";
import { elements } from "../../../test-support/element-tree";
import { CustomerArchiveDialog } from "./customer-archive-dialog";
import { CustomerDetailScreen } from "./customer-detail-screen";
import type { ConfirmableCommand } from "./use-confirmable-command";

const timestamp = "2026-09-27T18:00:00.000Z";
const receivable: Receivable = {
  id: "60000000-0000-4000-8000-000000000001",
  customerId: "60000000-0000-4000-8000-000000000002",
  state: "open",
  originalMinorUnits: "2500",
  paidMinorUnits: "0",
  outstandingMinorUnits: "2500",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  description: "Pedido de septiembre",
  postedDate: "2026-09-01",
  dueDate: "2026-09-15",
  voidedAt: null,
  voidReason: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};

function confirmable<T>(overrides: Omit<Partial<ConfirmableCommand<T>>, "confirm"> = {}) {
  const confirm = vi.fn<(build: () => T | null) => void>();
  const action: ConfirmableCommand<T> = {
    command: null,
    confirm,
    onOpenChange: vi.fn(),
    open: true,
    session: 1,
    state: { phase: "idle" },
    ...overrides,
  };
  return { action, confirm };
}

const dialogContext = { onRetryRead: vi.fn(), returnFocusRef: { current: null }, stale: false };

beforeEach(() => {
  captured.dialog = {};
  captured.stats = [];
});

describe("archive confirmation", () => {
  test("is an explicit destructive confirmation that builds a fresh idempotency key", () => {
    const { action, confirm } = confirmable<ArchiveCustomerRequest>();
    renderToStaticMarkup(
      createElement(CustomerArchiveDialog, { ...dialogContext, action, customerName: "Ana" }),
    );
    expect(captured.dialog).toMatchObject({
      confirmLabel: i18n.t("customers.archive.confirm"),
      destructive: true,
      open: true,
      phase: "idle",
    });
    captured.dialog.onConfirm?.();
    expect(confirm.mock.calls[0]?.[0]()).toEqual({
      idempotencyKey: "50000000-0000-4000-8000-000000000001",
    });
  });

  test("offers only the same confirmation again after an uncertain outcome", () => {
    const { action } = confirmable<ArchiveCustomerRequest>({
      command: { idempotencyKey: "kept" },
      state: { phase: "uncertain", message: "Connection lost" },
    });
    renderToStaticMarkup(
      createElement(CustomerArchiveDialog, { ...dialogContext, action, customerName: "Ana" }),
    );
    expect(captured.dialog).toMatchObject({
      errorMessage: undefined,
      phase: "uncertain",
      uncertainDescription: "Connection lost",
    });
  });

  test("keeps a definitive failure inside the dialog and stays open while pending", () => {
    renderToStaticMarkup(
      createElement(CustomerArchiveDialog, {
        action: confirmable<ArchiveCustomerRequest>({
          state: { phase: "failed", message: "Has a balance" },
        }).action,
        customerName: "Ana",
        ...dialogContext,
      }),
    );
    expect(captured.dialog).toMatchObject({ errorMessage: "Has a balance", phase: "failed" });
    renderToStaticMarkup(
      createElement(CustomerArchiveDialog, {
        action: confirmable<ArchiveCustomerRequest>({ state: { phase: "pending" } }).action,
        customerName: "Ana",
        ...dialogContext,
      }),
    );
    expect(captured.dialog.phase).toBe("pending");
  });

  test("blocks a first archive on stale data but never the retry of an uncertain one", () => {
    renderToStaticMarkup(
      createElement(CustomerArchiveDialog, {
        ...dialogContext,
        action: confirmable<ArchiveCustomerRequest>().action,
        customerName: "Ana",
        stale: true,
      }),
    );
    expect(captured.dialog.disabled).toBe(true);
    expect(renderToStaticMarkup(captured.dialog.children)).toContain(i18n.t("remote.stale"));
    renderToStaticMarkup(
      createElement(CustomerArchiveDialog, {
        ...dialogContext,
        action: confirmable<ArchiveCustomerRequest>({
          command: { idempotencyKey: "kept" },
          state: { phase: "uncertain", message: "Connection lost" },
        }).action,
        customerName: "Ana",
        stale: true,
      }),
    );
    // The shared dialog never disables the retry of an uncertain command, whatever `disabled` says.
    expect(captured.dialog).toMatchObject({ disabled: true, phase: "uncertain" });
    expect(renderToStaticMarkup(captured.dialog.children)).not.toContain(i18n.t("remote.stale"));
  });
});

describe("void confirmation", () => {
  test("sends nothing until a reason is written", () => {
    const { action, confirm } = confirmable<VoidReceivableRequest>();
    renderToStaticMarkup(
      createElement(ReceivableVoidDialog, { ...dialogContext, action, receivable }),
    );
    const [reason] = elements<ComponentProps<typeof Field>>(captured.dialog.children, Field);
    expect(reason?.props.editable).toBe(true);
    captured.dialog.onConfirm?.();
    expect(confirm.mock.calls[0]?.[0]()).toBeNull();
  });

  test("locks the reason to the command already sent while its outcome is uncertain", () => {
    const { action } = confirmable<VoidReceivableRequest>({
      command: { idempotencyKey: "kept", reason: "Cargo duplicado" },
      state: { phase: "uncertain", message: "Connection lost" },
    });
    renderToStaticMarkup(
      createElement(ReceivableVoidDialog, { ...dialogContext, action, receivable }),
    );
    const [reason] = elements<ComponentProps<typeof Field>>(captured.dialog.children, Field);
    expect(reason?.props).toMatchObject({ editable: false, value: "Cargo duplicado" });
    expect(captured.dialog.phase).toBe("uncertain");
  });

  test("returns focus to the menu that opened it", () => {
    const returnFocusRef = { current: { focus: vi.fn() } };
    renderToStaticMarkup(
      createElement(ReceivableVoidDialog, {
        ...dialogContext,
        action: confirmable<VoidReceivableRequest>().action,
        receivable,
        returnFocusRef,
      }),
    );
    expect(captured.dialog.returnFocus).toBe(returnFocusRef);
  });
});

describe("money tones", () => {
  const balance: CustomerDetail["balance"] = {
    currency: "USD",
    currencyMinorUnitDigits: 2,
    outstandingMinorUnits: "2500",
    overdueMinorUnits: "0",
    openReceivableCount: "1",
    overdueReceivableCount: "0",
    queriedAt: timestamp,
  };
  const customerDetail = (overdueMinorUnits: string) =>
    createElement(CustomerDetailScreen, {
      canCharge: true,
      canManage: true,
      menuTriggerRef: { current: null },
      onArchive: vi.fn(),
      onLoadMoreReceivables: vi.fn(),
      onRetry: vi.fn(),
      state: {
        kind: "ready",
        detail: {
          balance: { ...balance, overdueMinorUnits },
          customer: {
            id: receivable.customerId,
            name: "Ana",
            phone: null,
            email: null,
            notes: null,
            status: "active",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        },
        receivables: { kind: "ready", items: [], loadingMore: false, nextCursor: null },
        stale: false,
      },
    });
  const tone = (label: string) => captured.stats.find((stat) => stat.label === label)?.tone;

  test("a customer's overdue figure turns destructive only above zero", () => {
    renderToStaticMarkup(customerDetail("0"));
    expect(tone(i18n.t("customers.detail.overdue"))).toBe("default");
    captured.stats = [];
    renderToStaticMarkup(customerDetail("1"));
    expect(tone(i18n.t("customers.detail.overdue"))).toBe("destructive");
    expect(tone(i18n.t("customers.detail.outstanding"))).toBeUndefined();
  });

  test("the business overdue position turns destructive only above zero", () => {
    const summary: ReceivablesSummary = {
      ...balance,
      businessLocalDate: "2026-09-27",
      timeZone: "America/El_Salvador",
    };
    const list = (overdueMinorUnits: string) =>
      createElement(ReceivablesScreen, {
        canCreate: true,
        customerFilter: null,
        customerFilterRef: { current: null },
        customerNameFor: () => ({ kind: "ready", name: "Ana" }) as const,
        filters: { state: "all" },
        onChooseCustomer: vi.fn(),
        onClearCustomer: vi.fn(),
        onClearFilters: vi.fn(),
        onLoadMore: vi.fn(),
        onRetry: vi.fn(),
        onStateChange: vi.fn(),
        state: { kind: "empty", stale: false, summary: { ...summary, overdueMinorUnits } },
      });
    renderToStaticMarkup(list("0"));
    expect(tone(i18n.t("receivables.summary.overdue"))).toBe("default");
    captured.stats = [];
    renderToStaticMarkup(list("5000"));
    expect(tone(i18n.t("receivables.summary.overdue"))).toBe("destructive");
  });

  test("a receivable balance turns destructive only while it is overdue", () => {
    const detail = (state: Receivable["state"]) =>
      createElement(ReceivableDetailScreen, {
        accountNameFor: () => ({ kind: "unavailable" }) as const,
        canManage: true,
        menuTriggerRef: { current: null },
        onRetry: vi.fn(),
        onReversePayment: vi.fn(),
        onVoid: vi.fn(),
        state: {
          kind: "ready",
          customer: { active: true, id: receivable.customerId, name: "Ana" },
          payments: [],
          receivable: { ...receivable, state },
          stale: false,
        },
        timeZone: "America/El_Salvador",
      });
    renderToStaticMarkup(detail("open"));
    expect(tone(i18n.t("receivables.detail.outstanding"))).toBe("default");
    captured.stats = [];
    renderToStaticMarkup(detail("overdue"));
    expect(tone(i18n.t("receivables.detail.outstanding"))).toBe("destructive");
  });
});
