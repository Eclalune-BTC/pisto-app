import type { ReceivablePayment } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import type { TFunction } from "i18next";
import { Ban, Banknote, Undo2 } from "lucide-react-native";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellText } from "@/components/ui/cell-text";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { type FittedColumn, fitColumns, rendersCompactRecords } from "@/components/ui/fit-columns";
import { Icon } from "@/components/ui/icon";
import { RowActions } from "@/components/ui/row-actions";
import { Text } from "@/components/ui/text";
import { isPositiveAmount, type RecordFormat, useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { type MenuTrigger, OverflowActionMenu } from "@/features/customers/overflow-action-menu";
import { ScreenState } from "@/features/customers/screen-state";
import { useMeasuredWidth } from "@/lib/use-measured-width";

import { ReceivableStateBadge } from "./receivable-state-badge";
import { acceptsPayment, acceptsVoid, isReversed } from "./rules";
import type { AccountNameCell, ReceivableDetailLoadState } from "./types";

type ReceivableDetailScreenProps = {
  accountNameFor: (accountId: string) => AccountNameCell;
  /** Permission to record payments, reversals and voids. */
  canManage: boolean;
  /** The overflow menu trigger, where focus returns after the void dialog closes. */
  menuTriggerRef: RefObject<MenuTrigger | null>;
  /** An unresolved command shown above the record, such as a void whose outcome is unknown. */
  notice?: ReactNode;
  onRetry: () => void;
  onReversePayment: (paymentId: string) => void;
  onVoid: () => void;
  state: ReceivableDetailLoadState;
  timeZone: string;
};

type PaymentRow = { account: AccountNameCell; payment: ReceivablePayment; reversed: boolean };

/** The row-action column of the shared table. */
const ACTIONS_COLUMN_WIDTH = 48;

function AccountName({ account }: { account: AccountNameCell }) {
  const { t } = useTranslation();
  return account.kind === "ready" ? (
    <CellText maxWidth="max-w-[12rem]">{account.name}</CellText>
  ) : (
    <CellText className="text-muted-foreground" maxWidth="max-w-[12rem]">
      {account.kind === "loading"
        ? t("receivables.payments.accountLoading")
        : t("receivables.payments.accountUnavailable")}
    </CellText>
  );
}

function paymentColumns(format: RecordFormat, t: TFunction): FittedColumn<PaymentRow>[] {
  return [
    {
      estimate: 170,
      column: {
        id: "kind",
        header: t("dataTable.columns.type"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <View className="min-w-0 flex-row flex-wrap items-center gap-1.5">
            <Text className="text-[13px]">
              {original.payment.kind === "reversal"
                ? t("receivables.payments.reversal")
                : t("receivables.payments.payment")}
            </Text>
            {original.reversed ? (
              <Badge variant="outline">
                <Text>{t("receivables.payments.reversed")}</Text>
              </Badge>
            ) : null}
          </View>
        ),
      },
    },
    {
      estimate: 160,
      column: {
        id: "occurred",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
            {t("receivables.payments.occurredAt", {
              date: format.date(original.payment.occurredLocalDate),
              time: original.payment.occurredLocalTime,
            })}
          </Text>
        ),
      },
    },
    {
      estimate: 216,
      dropRank: 1,
      column: {
        id: "account",
        header: t("dataTable.columns.account"),
        cell: ({ row: { original } }) => <AccountName account={original.account} />,
      },
    },
    {
      estimate: 216,
      dropRank: 0,
      only: "table",
      column: {
        id: "reference",
        header: t("dataTable.columns.reference"),
        cell: ({ row: { original } }) =>
          original.payment.reference ? (
            <CellText className="text-muted-foreground" maxWidth="max-w-[12rem]">
              {original.payment.reference}
            </CellText>
          ) : (
            <Text
              accessibilityLabel={t("receivables.payments.noReference")}
              className="text-[13px] text-muted-foreground"
            >
              —
            </Text>
          ),
      },
    },
    // A reversal undoes money, and a reversed payment no longer counts toward what was paid.
    {
      estimate: 110,
      column: {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <MoneyText
            currency={original.payment.currency}
            digits={original.payment.currencyMinorUnitDigits}
            minorUnits={original.payment.amountMinorUnits}
            muted={original.reversed || original.payment.kind === "reversal"}
            negative={original.payment.kind === "reversal"}
          />
        ),
      },
    },
  ];
}

function outstandingDetail(
  t: TFunction,
  state: "open" | "overdue" | "paid" | "voided",
  dueDate: string | undefined,
): string {
  if (!dueDate) return t("receivables.list.noDueDate");
  if (state === "overdue") return t("receivables.detail.overdueSince", { date: dueDate });
  if (state === "open") return t("receivables.detail.dueOn", { date: dueDate });
  return t("receivables.detail.dueDateDetail", { date: dueDate });
}

export function ReceivableDetailScreen({
  accountNameFor,
  canManage,
  menuTriggerRef,
  notice,
  onRetry,
  onReversePayment,
  onVoid,
  state,
  timeZone,
}: ReceivableDetailScreenProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { onLayout, width } = useMeasuredWidth();
  if (state.kind !== "ready") {
    return <ScreenState kind={state.kind} onRetry={onRetry} skeleton="detail" />;
  }

  const { customer, payments, receivable } = state;
  const money = (minorUnits: string) =>
    format.money(minorUnits, receivable.currency, receivable.currencyMinorUnitDigits);
  const payable = canManage && acceptsPayment(receivable, customer.active);
  const voidable = canManage && receivable.state !== "voided";
  const paymentHref: Href = {
    pathname: "/operate/receivables/[receivableId]/payment",
    params: { receivableId: receivable.id },
  };
  const customerHref: Href = {
    pathname: "/operate/customers/[customerId]",
    params: { customerId: customer.id },
  };
  const facts: DescriptionItem[] = [
    {
      label: t("receivables.detail.customer"),
      value: (
        <Link asChild href={customerHref}>
          <Text className="self-start text-sm leading-5 text-foreground underline web:underline-offset-4">
            {customer.name}
          </Text>
        </Link>
      ),
    },
    ...(receivable.voidedAt
      ? [
          {
            label: t("receivables.detail.voidedAt"),
            numeric: true,
            value: format.instant(receivable.voidedAt, timeZone),
          },
        ]
      : []),
    ...(receivable.voidReason
      ? [{ label: t("receivables.detail.voidReason"), value: receivable.voidReason }]
      : []),
  ];
  const reversible = (row: PaymentRow) => row.payment.kind === "payment" && !row.reversed;

  return (
    <Page>
      <PageHeader
        actions={
          payable || voidable ? (
            <>
              {voidable ? (
                <OverflowActionMenu
                  action={{
                    disabledReason: acceptsVoid(receivable)
                      ? undefined
                      : t("receivables.detail.voidNeedsNoPayments"),
                    icon: Ban,
                    label: t("receivables.detail.void"),
                    onPress: onVoid,
                  }}
                  label={t("receivables.detail.moreActions")}
                  triggerRef={menuTriggerRef}
                />
              ) : null}
              {payable ? (
                <Link asChild href={paymentHref}>
                  <Button accessibilityRole="link">
                    <Icon as={Banknote} className="text-primary-foreground" size={16} />
                    <Text>{t("receivables.detail.applyPayment")}</Text>
                  </Button>
                </Link>
              ) : null}
            </>
          ) : undefined
        }
        adornment={<ReceivableStateBadge state={receivable.state} />}
        title={receivable.description}
      />
      {state.stale ? <StaleNotice onRetry={onRetry} /> : null}
      {notice}
      <StatGroup>
        <Stat
          detail={t("receivables.detail.postedOn", { date: format.date(receivable.postedDate) })}
          label={t("receivables.detail.amount")}
          value={money(receivable.originalMinorUnits)}
        />
        <Stat label={t("receivables.detail.paid")} value={money(receivable.paidMinorUnits)} />
        <Stat
          detail={outstandingDetail(
            t,
            receivable.state,
            receivable.dueDate ? format.date(receivable.dueDate) : undefined,
          )}
          label={t("receivables.detail.outstanding")}
          tone={
            receivable.state === "overdue" && isPositiveAmount(receivable.outstandingMinorUnits)
              ? "destructive"
              : "default"
          }
          value={money(receivable.outstandingMinorUnits)}
        />
      </StatGroup>
      <Section title={t("receivables.detail.facts")}>
        <DescriptionList items={facts} />
      </Section>
      <Section
        description={t("receivables.payments.description")}
        title={t("receivables.payments.title")}
      >
        {payments.length === 0 ? (
          <EmptyState
            action={
              payable ? (
                <Link asChild href={paymentHref}>
                  <Button accessibilityRole="link" size="sm" variant="outline">
                    <Text>{t("receivables.detail.applyPayment")}</Text>
                  </Button>
                </Link>
              ) : undefined
            }
            description={
              receivable.state === "voided"
                ? t("receivables.payments.emptyVoided")
                : t("receivables.payments.emptyDescription")
            }
            icon={Banknote}
            title={t("receivables.payments.emptyTitle")}
          />
        ) : (
          <View className="min-w-0" onLayout={onLayout}>
            <DataTable
              caption={t("receivables.payments.title")}
              columns={fitColumns(
                paymentColumns(format, t),
                width - (canManage ? ACTIONS_COLUMN_WIDTH : 0),
                rendersCompactRecords(width),
              )}
              data={payments.map((payment) => ({
                account: accountNameFor(payment.cashAccountId),
                payment,
                reversed: isReversed(payment, payments),
              }))}
              getRowId={({ payment }) => payment.id}
              rowActions={
                canManage
                  ? (row) =>
                      reversible(row) ? (
                        <RowActions
                          actions={[
                            {
                              destructive: true,
                              icon: Undo2,
                              label: t("receivables.payments.reverse"),
                              onPress: () => onReversePayment(row.payment.id),
                            },
                          ]}
                          label={t("receivables.payments.actions")}
                        />
                      ) : (
                        // Every row keeps the action slot so heights and amounts stay aligned.
                        <View aria-hidden className="h-8 w-8 native:h-10 native:w-10" />
                      )
                  : undefined
              }
            />
          </View>
        )}
      </Section>
    </Page>
  );
}
