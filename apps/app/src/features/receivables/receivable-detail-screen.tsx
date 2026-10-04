import type { ReceivablePayment } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import type { TFunction } from "i18next";
import { Ban, Banknote, Ellipsis, Undo2 } from "lucide-react-native";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { RowActions } from "@/components/ui/row-actions";
import { Text } from "@/components/ui/text";
import { isPositiveAmount, type RecordFormat, useRecordFormat } from "@/features/customers/format";
import { ScreenState } from "@/features/customers/screen-state";

import { ReceivableStateBadge } from "./receivable-state-badge";
import { acceptsPayment, acceptsVoid, isReversed } from "./rules";
import type { AccountNameCell, ReceivableDetailLoadState } from "./types";

type ReceivableDetailScreenProps = {
  accountNameFor: (accountId: string) => AccountNameCell;
  canManage: boolean;
  onRetry: () => void;
  onReversePayment: (paymentId: string) => void;
  onVoid: () => void;
  state: ReceivableDetailLoadState;
  timeZone: string;
};

function VoidMenu({ blocked, onVoid }: { blocked: boolean; onVoid: () => void }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          accessibilityLabel={t("receivables.detail.moreActions")}
          size="icon"
          variant="outline"
        >
          <Icon as={Ellipsis} className="text-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" sideOffset={4}>
        <DropdownMenuItem disabled={blocked} onPress={onVoid} variant="destructive">
          <Icon as={Ban} className="text-destructive" size={15} />
          <View className="min-w-0 flex-1">
            <Text>{t("receivables.detail.void")}</Text>
            {blocked ? (
              <Text className="text-xs leading-4 text-muted-foreground">
                {t("receivables.detail.voidNeedsNoPayments")}
              </Text>
            ) : null}
          </View>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type PaymentRow = { account: AccountNameCell; payment: ReceivablePayment; reversed: boolean };

function AccountName({ account }: { account: AccountNameCell }) {
  const { t } = useTranslation();
  return account.kind === "ready" ? (
    <Text className="text-[13px]" numberOfLines={1}>
      {account.name}
    </Text>
  ) : (
    <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
      {account.kind === "loading"
        ? t("receivables.payments.accountLoading")
        : t("receivables.payments.accountUnavailable")}
    </Text>
  );
}

function paymentColumns(format: RecordFormat, t: TFunction): DataTableColumn<PaymentRow>[] {
  return [
    {
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
    {
      id: "occurred",
      header: t("dataTable.columns.date"),
      cell: ({ row: { original } }) => (
        <Text className="text-[13px] text-muted-foreground tabular-nums">
          {t("receivables.payments.occurredAt", {
            date: format.date(original.payment.occurredLocalDate),
            time: original.payment.occurredLocalTime,
          })}
        </Text>
      ),
    },
    {
      id: "account",
      header: t("dataTable.columns.account"),
      cell: ({ row: { original } }) => <AccountName account={original.account} />,
    },
    {
      id: "reference",
      header: t("dataTable.columns.reference"),
      meta: { hideOnCompact: true },
      cell: ({ row: { original } }) =>
        original.payment.reference ? (
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {original.payment.reference}
          </Text>
        ) : (
          <Text
            accessibilityLabel={t("receivables.payments.noReference")}
            className="text-[13px] text-muted-foreground"
          >
            —
          </Text>
        ),
    },
    {
      id: "amount",
      header: t("dataTable.columns.amount"),
      meta: { align: "end" },
      cell: ({ row: { original } }) => (
        <Text className="font-ui text-[13px] tabular-nums">
          {format.money(
            original.payment.amountMinorUnits,
            original.payment.currency,
            original.payment.currencyMinorUnitDigits,
          )}
        </Text>
      ),
    },
  ];
}

export function ReceivableDetailScreen({
  accountNameFor,
  canManage,
  onRetry,
  onReversePayment,
  onVoid,
  state,
  timeZone,
}: ReceivableDetailScreenProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
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
    {
      label: t("receivables.detail.postedDate"),
      numeric: true,
      value: format.date(receivable.postedDate),
    },
    {
      label: t("receivables.detail.dueDate"),
      numeric: Boolean(receivable.dueDate),
      value: receivable.dueDate ? format.date(receivable.dueDate) : t("receivables.list.noDueDate"),
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
  const dueDate = receivable.dueDate ? format.date(receivable.dueDate) : undefined;

  return (
    <Page>
      <PageHeader
        actions={
          payable || voidable ? (
            <>
              {voidable ? <VoidMenu blocked={!acceptsVoid(receivable)} onVoid={onVoid} /> : null}
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
        description={receivable.description}
        title={customer.name}
      />
      {state.stale ? <StaleNotice onRetry={onRetry} /> : null}
      <StatGroup>
        <Stat
          detail={t("receivables.detail.postedOn", { date: format.date(receivable.postedDate) })}
          label={t("receivables.detail.amount")}
          value={money(receivable.originalMinorUnits)}
        />
        <Stat label={t("receivables.detail.paid")} value={money(receivable.paidMinorUnits)} />
        <Stat
          detail={
            receivable.state === "overdue" && dueDate
              ? t("receivables.detail.overdueSince", { date: dueDate })
              : receivable.state === "open" && dueDate
                ? t("receivables.detail.dueOn", { date: dueDate })
                : undefined
          }
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
                  <Button accessibilityRole="link" size="sm">
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
          <DataTable
            caption={t("receivables.payments.title")}
            columns={paymentColumns(format, t)}
            data={payments.map((payment) => ({
              account: accountNameFor(payment.cashAccountId),
              payment,
              reversed: isReversed(payment, payments),
            }))}
            getRowId={({ payment }) => payment.id}
            rowActions={
              canManage
                ? ({ payment, reversed }) =>
                    payment.kind === "payment" && !reversed ? (
                      <RowActions
                        actions={[
                          {
                            destructive: true,
                            icon: Undo2,
                            label: t("receivables.payments.reverse"),
                            onPress: () => onReversePayment(payment.id),
                          },
                        ]}
                        label={t("receivables.payments.actions")}
                      />
                    ) : null
                : undefined
            }
          />
        )}
      </Section>
    </Page>
  );
}
