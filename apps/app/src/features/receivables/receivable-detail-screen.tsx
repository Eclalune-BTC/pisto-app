import type { ReceivablePayment } from "@pisto/contracts";
import { ArrowLeft } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

import type { ReceivableDetailLoadState, ReceivablesCopy } from "./types";

type ReceivableDetailScreenProps = {
  canManage: boolean;
  cashAccountNameFor: (cashAccountId: string) => string;
  copy: ReceivablesCopy;
  customerActive: boolean;
  customerName: string;
  formatDate: (date: string) => string;
  formatMoney: (minorUnits: string, currency: string, digits: number) => string;
  onApplyPayment: () => void;
  onBack: () => void;
  onRetry: () => void;
  onReversePayment: (paymentId: string) => void;
  onVoid: () => void;
  state: ReceivableDetailLoadState;
};

export function ReceivableDetailScreen({
  canManage,
  cashAccountNameFor,
  copy,
  customerActive,
  customerName,
  formatDate,
  formatMoney,
  onApplyPayment,
  onBack,
  onRetry,
  onReversePayment,
  onVoid,
  state,
}: ReceivableDetailScreenProps) {
  const { t } = useTranslation();
  const payments = state.kind === "ready" ? state.payments : undefined;
  const columns = useMemo<DataTableColumn<ReceivablePayment>[]>(
    () => [
      {
        id: "type",
        header: t("dataTable.columns.type"),
        meta: { primary: true },
        cell: ({ row: { original: payment } }) => (
          <Text className="font-ui text-sm text-foreground">
            {payment.kind === "reversal" ? copy.reversedPayment : copy.applyPayment}
          </Text>
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original: payment } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {formatDate(payment.occurredLocalDate)}
          </Text>
        ),
      },
      {
        id: "account",
        header: t("dataTable.columns.account"),
        cell: ({ row: { original: payment } }) => (
          <Text className="font-sans text-sm text-foreground">
            {cashAccountNameFor(payment.cashAccountId)}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original: payment } }) => (
          <Text className="font-ui text-sm text-foreground">
            {formatMoney(
              payment.amountMinorUnits,
              payment.currency,
              payment.currencyMinorUnitDigits,
            )}
          </Text>
        ),
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("dataTable.columns.actions"),
              cell: ({ row: { original: payment } }) =>
                payment.kind === "payment" &&
                !payments?.some(
                  (candidate) =>
                    candidate.kind === "reversal" && candidate.reversesPaymentId === payment.id,
                ) ? (
                  <Button
                    label={copy.reverse}
                    onPress={() => onReversePayment(payment.id)}
                    size="sm"
                    variant="outline"
                  />
                ) : null,
            } satisfies DataTableColumn<ReceivablePayment>,
          ]
        : []),
    ],
    [canManage, cashAccountNameFor, copy, formatDate, formatMoney, onReversePayment, payments, t],
  );
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator />
        <Text className="font-sans text-sm text-muted-foreground">{copy.loading}</Text>
      </View>
    );
  }
  if (state.kind !== "ready") {
    const title =
      state.kind === "offline"
        ? copy.offlineTitle
        : state.kind === "denied"
          ? copy.deniedTitle
          : state.kind === "notFound"
            ? copy.unavailableTitle
            : copy.errorTitle;
    const description =
      state.kind === "offline"
        ? copy.offlineDescription
        : state.kind === "denied"
          ? copy.deniedDescription
          : state.kind === "notFound"
            ? copy.unavailableDescription
            : copy.errorDescription;
    return (
      <Page>
        <Button label={copy.back} onPress={onBack} variant="ghost" />
        <View className="gap-3 border-y border-border py-8">
          <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
            {title}
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted-foreground">{description}</Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="outline" />
          ) : null}
        </View>
      </Page>
    );
  }

  const item = state.receivable;
  const stateLabel = {
    open: copy.open,
    overdue: copy.overdue,
    paid: copy.paid,
    voided: copy.voided,
  }[item.state];
  return (
    <Page contentContainerClassName="gap-8">
      <Button
        accessibilityLabel={copy.back}
        className="self-start px-0"
        onPress={onBack}
        size="sm"
        variant="ghost"
      >
        <Icon as={ArrowLeft} className="text-muted-foreground" size={18} />
        <Text className="font-ui text-foreground">{copy.back}</Text>
      </Button>
      <ScreenHeader
        action={
          canManage && item.state !== "voided" ? (
            <View className="flex-row gap-2">
              {customerActive && item.outstandingMinorUnits !== "0" ? (
                <Button label={copy.applyPayment} onPress={onApplyPayment} variant="default" />
              ) : null}
              {item.paidMinorUnits === "0" ? (
                <Button label={copy.void} onPress={onVoid} variant="ghost" />
              ) : null}
            </View>
          ) : undefined
        }
        description={`${item.description} — ${stateLabel}`}
        title={customerName}
      />
      {state.stale ? (
        <View className="border-l-4 border-warning bg-muted p-3">
          <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
        </View>
      ) : null}
      <View className="gap-5 border-y border-border py-6 lg:flex-row">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xs font-ui text-muted-foreground">{copy.outstanding}</Text>
          <Text className="text-3xl font-heading text-foreground">
            {formatMoney(item.outstandingMinorUnits, item.currency, item.currencyMinorUnitDigits)}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-2 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.originalAmount}:{" "}
            {formatMoney(item.originalMinorUnits, item.currency, item.currencyMinorUnitDigits)}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.postedDate}: {formatDate(item.postedDate)}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.dueDate}: {item.dueDate ? formatDate(item.dueDate) : copy.noDueDate}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
          {copy.paymentHistory}
        </Text>
        {state.payments.length === 0 ? (
          <Text className="font-sans border-t border-border py-5 text-sm text-muted-foreground">
            {copy.noPayments}
          </Text>
        ) : (
          <DataTable
            caption={copy.paymentHistory}
            columns={columns}
            data={state.payments}
            getRowId={(payment) => payment.id}
          />
        )}
      </View>
    </Page>
  );
}
