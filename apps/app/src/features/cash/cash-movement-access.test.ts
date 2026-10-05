import type { CashAccount, CashMovement } from "@pisto/contracts";
import { type ComponentProps, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#62626B") : "#62626B",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("@/components/ui/select-field", () => ({ SelectField: () => null }));

import { DescriptionList } from "@/components/layout/description-list";
import { AlertDialog, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { i18n } from "@/i18n/config";
import type { MutationPhase } from "@/lib/mutation-phase";
import { elements } from "../../../test-support/element-tree";
import { CashAccountEditorScreen } from "./cash-account-editor-screen";
import { CashAdjustmentScreen } from "./cash-adjustment-screen";
import { CashMovementDialog, CashReversalDialog } from "./cash-movement-dialogs";
import { CashTransferScreen } from "./cash-transfer-screen";
import { LocalDateTimeFields } from "./local-date-time-fields";

const t = i18n.t;
const noop = () => undefined;

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

/** Text written directly in an element tree, without rendering portal content. */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (node && typeof node === "object" && "props" in node) {
    const { children, ...props } = (node as ReactElement<Record<string, unknown>>).props;
    return [textOf(children), ...Object.values(props).map(textOf)].join(" ");
  }
  return "";
}

function dialog(phase: MutationPhase, changes: Partial<ComponentProps<typeof ConfirmDialog>> = {}) {
  const props: ComponentProps<typeof ConfirmDialog> = {
    confirmLabel: "Revertir ajuste",
    description: "Effect",
    destructive: true,
    errorMessage: "The server refused the reversal",
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    open: true,
    phase,
    title: "Title",
    uncertainDescription: t("cash.review.uncertainDescription"),
    ...changes,
  };
  const { tree } = capture(ConfirmDialog, props);
  const [root] = elements<ComponentProps<typeof AlertDialog>>([tree], AlertDialog);
  const [cancel] = elements<ComponentProps<typeof AlertDialogCancel>>(tree, AlertDialogCancel);
  const [confirm] = elements<ComponentProps<typeof Button>>(tree, Button);
  if (!root || !cancel || !confirm) throw new Error("The dialog is incomplete.");
  return { cancel, confirm, props, root, tree };
}

describe("confirmed money commands in a dialog", () => {
  test("keeps an uncertain outcome open and offers only the same confirmation again", () => {
    const { cancel, confirm, props, root, tree } = dialog("uncertain");
    expect(confirm.props.label).toBe(t("common.retrySameConfirmation"));
    expect(confirm.props.variant).toBe("default");
    expect(confirm.props.disabled).toBe(false);
    expect(cancel.props.disabled).toBe(true);
    root.props.onOpenChange?.(false);
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain(t("cash.review.uncertainDescription"));
    expect(textOf(tree)).not.toContain(props.errorMessage);
  });

  test("cannot be dismissed while the command is pending", () => {
    const { cancel, confirm, props, root } = dialog("pending");
    expect(confirm.props.loading).toBe(true);
    expect(cancel.props.disabled).toBe(true);
    root.props.onOpenChange?.(false);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  test("shows a definitive failure and lets the user correct or leave", () => {
    const { cancel, confirm, props, root, tree } = dialog("failed");
    expect(confirm.props.label).toBe("Revertir ajuste");
    expect(confirm.props.variant).toBe("destructive");
    expect(cancel.props.disabled).toBe(false);
    expect(textOf(tree)).toContain(props.errorMessage);
    root.props.onOpenChange?.(false);
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  test("blocks a new confirmation when access or freshness is lost", () => {
    expect(dialog("idle", { disabled: true }).confirm.props.disabled).toBe(true);
  });

  test("still resends an uncertain command after access or freshness is lost", () => {
    // The dialog cannot be dismissed while uncertain, so a disabled retry would trap the user.
    const { confirm, props } = dialog("uncertain", { disabled: true });
    expect(confirm.props.disabled).toBe(false);
    confirm.props.onPress?.({} as never);
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });
});

const movement: CashMovement = {
  id: "movement",
  accountId: "account",
  action: "adjustment_in",
  direction: "in",
  amountMinorUnits: "100",
  deltaMinorUnits: "100",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: "2026-09-10T16:00:00Z",
  occurredLocalDate: "2026-09-10",
  occurredLocalTime: "10:00",
  timeZone: "America/El_Salvador",
  reason: "Private movement reason",
  expenseId: null,
  transferId: null,
  receivablePaymentId: null,
  reversalOfMovementId: null,
  createdAt: "2026-09-10T16:00:00Z",
};

describe("cash movement facts", () => {
  function facts(changes: Partial<ComponentProps<typeof CashMovementDialog>> = {}) {
    return capture(CashMovementDialog, {
      account: "Private account",
      actionLabel: "Ajuste de entrada",
      amount: "$1.00",
      movement,
      occurredAt: "10/9/26, 10:00 a. m.",
      onClose: noop,
      open: true,
      recordedAt: "10/9/26, 10:05 a. m.",
      reversed: false,
      ...changes,
    }).tree;
  }
  const labels = (tree: ReactElement) =>
    elements<ComponentProps<typeof Button>>(tree, Button).map((button) => button.props.label);

  test("offers the one-time reversal only when the caller allows it", () => {
    const onReverse = vi.fn();
    const reversible = elements<ComponentProps<typeof Button>>(facts({ onReverse }), Button);
    expect(reversible.map((button) => button.props.label)).toEqual([
      t("cash.movementDetail.reverse"),
    ]);
    reversible[0]?.props.onPress?.({} as never);
    expect(onReverse).toHaveBeenCalledOnce();
    expect(labels(facts())).toEqual([]);
  });

  test("states when the movement was recorded, which orders the lists", () => {
    const [list] = elements<ComponentProps<typeof DescriptionList>>(facts(), DescriptionList);
    expect(list?.props.items).toContainEqual({
      label: t("cash.movementDetail.recordedAt"),
      numeric: true,
      value: "10/9/26, 10:05 a. m.",
    });
  });

  test("states an existing reversal and links a paid expense to its record", () => {
    const reversed = facts({ reversed: true });
    expect(textOf(reversed)).toContain(t("cash.movementDetail.reversed"));
    const expense = facts({
      movement: { ...movement, action: "expense", expenseId: "expense-a" },
    });
    expect(labels(expense)).toEqual([t("cash.movementDetail.viewExpense")]);
  });

  test("freezes the reversal fields while the outcome is pending or unknown", () => {
    for (const [phase, locked] of [
      ["idle", false],
      ["failed", false],
      ["pending", true],
      ["uncertain", true],
    ] as const) {
      const { tree } = capture(CashReversalDialog, {
        amount: "$1.00",
        canConfirm: true,
        draft: { localDate: "2026-09-10", localTime: "11:00", reason: "Duplicado" },
        errors: {},
        onCancel: noop,
        onConfirm: noop,
        onDraftChange: noop,
        open: true,
        phase,
      });
      const [reason] = elements<ComponentProps<typeof Field>>(tree, Field);
      const [when] = elements<ComponentProps<typeof LocalDateTimeFields>>(
        tree,
        LocalDateTimeFields,
      );
      expect(reason?.props.editable, phase).toBe(!locked);
      expect(when?.props.disabled, phase).toBe(locked);
      expect((tree.props as { phase: MutationPhase }).phase).toBe(phase);
    }
  });
});

describe("cash reviews keep what was reviewed across list refetches", () => {
  const account = {
    id: "original-account",
    name: "Reviewed source",
    status: "active",
    allowNegativeBalance: false,
    balanceMinorUnits: "100000",
    currency: "USD",
    currencyMinorUnitDigits: 2,
  } as CashAccount;
  const destination = { ...account, id: "destination-account", name: "Reviewed destination" };
  const common = {
    accounts: [],
    accountsPage: { hasMore: false, loadingMore: false, onLoadMore: noop },
    canConfirm: true,
    errors: {},
    formatMoney: () => "USD 1.00",
    onCancel: noop,
    onConfirm: noop,
    onDraftChange: noop,
    onEdit: noop,
    onPrepareReview: noop,
  };
  function expectLockedReview(markup: string, phase: "pending" | "uncertain") {
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain(t("cash.overview.newAccount"));
    if (phase === "uncertain") {
      expect(markup).toContain(t("common.retrySameConfirmation"));
      expect(markup).not.toContain(`>${t("common.edit")}<`);
    } else {
      expect(markup).toMatch(new RegExp(`disabled=""[^>]*>[^<]*<div[^>]*>${t("common.edit")}<`));
    }
  }

  test.each(["pending", "uncertain"] as const)(
    "adjustment stays in %s review after its account leaves the list",
    (phase) => {
      const markup = renderToStaticMarkup(
        createElement(CashAdjustmentScreen, {
          ...common,
          command: {
            accountId: account.id,
            amountMinorUnits: "100",
            currency: "USD",
            direction: "in",
            idempotencyKey: "original-key",
            occurredLocalDate: "2026-09-10",
            occurredLocalTime: "11:00",
            reason: "Reason",
          },
          draft: {
            accountId: account.id,
            amount: "1",
            direction: "in",
            localDate: "2026-09-10",
            localTime: "11:00",
            reason: "Reason",
          },
          phase,
          reviewAccount: account,
        }),
      );
      expect(markup).toContain(account.name);
      expectLockedReview(markup, phase);
    },
  );

  test.each(["pending", "uncertain"] as const)(
    "transfer stays in %s review after both accounts leave the list",
    (phase) => {
      const markup = renderToStaticMarkup(
        createElement(CashTransferScreen, {
          ...common,
          command: {
            amountMinorUnits: "100",
            currency: "USD",
            fromAccountId: account.id,
            idempotencyKey: "original-key",
            occurredLocalDate: "2026-09-10",
            occurredLocalTime: "11:00",
            toAccountId: destination.id,
          },
          draft: {
            amount: "1",
            fromAccountId: account.id,
            localDate: "2026-09-10",
            localTime: "11:00",
            note: "",
            toAccountId: destination.id,
          },
          phase,
          reviewAccounts: [account, destination],
        }),
      );
      expect(markup).toContain(account.name);
      expect(markup).toContain(destination.name);
      expectLockedReview(markup, phase);
    },
  );

  test("blocks a first confirmation, never the same-command retry, once access is lost", () => {
    const disabledButton = (label: string) =>
      new RegExp(`disabled=""[^>]*>[^<]*<div[^>]*>${label}<`);
    const review = (phase: "idle" | "uncertain") =>
      renderToStaticMarkup(
        createElement(CashAdjustmentScreen, {
          ...common,
          canConfirm: false,
          command: {
            accountId: account.id,
            amountMinorUnits: "100",
            currency: "USD",
            direction: "in",
            idempotencyKey: "original-key",
            occurredLocalDate: "2026-09-10",
            occurredLocalTime: "11:00",
            reason: "Reason",
          },
          draft: {
            accountId: account.id,
            amount: "1",
            direction: "in",
            localDate: "2026-09-10",
            localTime: "11:00",
            reason: "Reason",
          },
          phase,
          reviewAccount: account,
        }),
      );
    expect(review("idle")).toMatch(disabledButton(t("cash.adjustment.confirm")));
    const uncertain = review("uncertain");
    expect(uncertain).toContain(t("common.retrySameConfirmation"));
    expect(uncertain).not.toMatch(disabledButton(t("common.retrySameConfirmation")));
  });

  test("shows each changed account field next to the value it replaces", () => {
    const markup = renderToStaticMarkup(
      createElement(CashAccountEditorScreen, {
        ...common,
        account: { ...account, allowNegativeBalance: false, kind: "cash" },
        command: { allowNegativeBalance: true, idempotencyKey: "update-key" },
        currency: "USD",
        draft: {} as never,
        formatMoney: () => "USD 1.00",
        phase: "idle",
      }),
    );
    expect(markup).toContain(
      t("cash.review.change", {
        after: t("cash.accountDetail.negativeAllowed"),
        before: t("cash.accountDetail.negativeProtected"),
      }),
    );
    expect(markup).toContain(account.name);
    expect(markup).not.toContain(
      t("cash.review.change", { after: account.name, before: account.name }),
    );
  });
});
