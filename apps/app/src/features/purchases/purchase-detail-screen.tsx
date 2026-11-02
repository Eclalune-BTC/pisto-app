import type { ReceivePurchaseRequest, VoidPurchaseRequest } from "@pisto/contracts";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { CircleX, HandCoins, PackageCheck } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DescriptionList } from "@/components/layout/description-list";
import { HeaderActions, type MenuTrigger } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { MomentFields } from "@/components/ui/moment-fields";
import { Text } from "@/components/ui/text";
import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { commandPhase } from "@/features/customers/command-state";
import { isPositiveAmount, useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { readState } from "@/features/customers/read-state";
import { useConfirmableCommand } from "@/features/customers/use-confirmable-command";
import { cashAccountDetailQueryOptions } from "@/features/receivables/cash-account-source";
import { uniqueValues } from "@/features/receivables/presentation";
import { currentLocalDateTime } from "@/lib/money";
import { notify } from "@/lib/notify";
import { hasDeniedRead } from "@/lib/query-state";
import { firstParam } from "@/lib/route-params";

import { purchasesApi } from "./api";
import { PurchaseStateBadge, quantityText } from "./presentation";
import { invalidatePurchaseMutation, purchaseQueryOptions } from "./queries";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";

export function PurchaseDetailScreen() {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const purchaseId = firstParam(
    useLocalSearchParams<{ purchaseId?: string | string[] }>().purchaseId,
  );
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const detail = useQuery({
    ...purchaseQueryOptions(businessId, purchaseId),
    enabled: enabled && purchaseId !== undefined,
  });
  const accountIds = uniqueValues(detail.data?.payments.map(({ accountId }) => accountId) ?? []);
  const accounts = useQueries({
    queries: accountIds.map((accountId) => ({
      ...cashAccountDetailQueryOptions(businessId, accountId),
      enabled,
    })),
  });
  const menuTriggerRef = useRef<MenuTrigger>(null);
  const [paying, setPaying] = useState(false);
  const [moment, setMoment] = useState({ date: "", time: "" });
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const afterCommand = async (message: string) => {
    if (!businessId) throw new Error("A purchase command requires its business");
    await invalidatePurchaseMutation(queryClient, businessId);
    notify.success(message);
  };
  const receive = useConfirmableCommand({
    conflictMessage: t("purchases.detail.receiveUncertain"),
    mutationFn: (command: ReceivePurchaseRequest) => {
      if (!purchaseId) throw new Error("Receiving requires the purchase");
      return purchasesApi.purchases.receive(purchaseId, command);
    },
    onConfirmed: () => afterCommand(t("purchases.detail.received")),
  });
  const voidCommand = useConfirmableCommand({
    conflictMessage: t("purchases.detail.voidUncertain"),
    mutationFn: (command: VoidPurchaseRequest) => {
      if (!purchaseId) throw new Error("Voiding requires the purchase");
      return purchasesApi.purchases.void(purchaseId, command);
    },
    onConfirmed: () => afterCommand(t("purchases.detail.voided")),
  });
  const accessState = capabilityBoundaryState(access);
  const purchase = detail.data?.purchase;
  useRouteLabel(
    "/operate/purchases/[purchaseId]",
    accessState === "ready" && !hasDeniedRead([detail]) ? purchase?.supplierName : undefined,
  );

  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <RouteState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
        variant="detail"
      />
    );
  }
  const read = purchaseId ? readState([detail]) : ({ kind: "notFound" } as const);
  if (read.kind !== "ready" || !purchase || !detail.data) {
    return (
      <RouteState
        kind={read.kind === "ready" ? "error" : read.kind}
        onRetry={() => void detail.refetch()}
        title={read.kind === "notFound" ? t("purchases.detail.notFoundTitle") : undefined}
        variant="detail"
      />
    );
  }
  const { payments } = detail.data;
  const stale = read.stale || access.isStale;
  const money = (minorUnits: string) =>
    format.money(minorUnits, purchase.currency, purchase.currencyMinorUnitDigits);
  const posted = purchase.status === "posted";
  const owes = posted && isPositiveAmount(purchase.balanceMinorUnits);
  const canManage = access.hasManagePermission;
  const accountName = (accountId: string) => {
    const query = accounts[accountIds.indexOf(accountId)];
    if (query?.data) return query.data.account.name;
    return query?.isPending && query.fetchStatus !== "paused"
      ? t("purchases.detail.accountLoading")
      : t("purchases.detail.accountUnavailable");
  };
  const date = format.date(purchase.occurredLocalDate);

  return (
    <Page>
      <PageHeader
        actions={
          canManage && posted ? (
            <HeaderActions
              menuLabel={t("purchases.detail.moreActions")}
              menuTriggerRef={menuTriggerRef}
              overflow={[
                {
                  destructive: true,
                  disabled: payments.length > 0 || stale,
                  disabledReason:
                    payments.length > 0 ? t("purchases.detail.voidNeedsNoPayments") : undefined,
                  icon: CircleX,
                  label: t("purchases.detail.void"),
                  onPress: () => {
                    setReason("");
                    setReasonError(undefined);
                    voidCommand.onOpenChange(true);
                  },
                },
              ]}
              primary={
                owes
                  ? {
                      disabled: stale,
                      icon: HandCoins,
                      label: t("purchases.detail.registerPayment"),
                      onPress: () => setPaying(true),
                    }
                  : undefined
              }
              secondary={
                purchase.received
                  ? []
                  : [
                      {
                        disabled: stale,
                        icon: PackageCheck,
                        label: t("purchases.detail.receive"),
                        onPress: () => {
                          setMoment(currentLocalDateTime(purchase.timeZone));
                          receive.onOpenChange(true);
                        },
                      },
                    ]
              }
            />
          ) : undefined
        }
        adornment={<PurchaseStateBadge purchase={purchase} />}
        description={
          purchase.invoiceNumber
            ? t("purchases.detail.descriptionInvoice", { date, invoice: purchase.invoiceNumber })
            : t("purchases.detail.descriptionNoInvoice", { date })
        }
        title={t("purchases.detail.title", { supplier: purchase.supplierName })}
      />
      {stale ? <StaleNotice onRetry={() => void detail.refetch()} /> : null}
      <StatGroup>
        <Stat label={t("purchases.detail.total")} value={money(purchase.totalMinorUnits)} />
        <Stat label={t("purchases.detail.paid")} value={money(purchase.paidMinorUnits)} />
        <Stat
          label={t("purchases.detail.balance")}
          tone={purchase.payableState === "overdue" && owes ? "destructive" : "default"}
          value={money(purchase.balanceMinorUnits)}
        />
      </StatGroup>
      <DescriptionList
        items={[
          {
            label: t("purchases.detail.supplier"),
            value: (
              <Link
                href={{
                  pathname: "/operate/suppliers/[supplierId]",
                  params: { supplierId: purchase.supplierId },
                }}
              >
                <Text className="text-sm text-primary web:hover:underline">
                  {purchase.supplierName}
                </Text>
              </Link>
            ),
          },
          {
            label: t("purchases.detail.occurred"),
            numeric: true,
            value: t("purchases.detail.occurredAt", { date, time: purchase.occurredLocalTime }),
          },
          {
            label: t("purchases.detail.paymentTerms"),
            value: t(`purchases.terms.${purchase.paymentTerms}`),
          },
          ...(purchase.dueDate
            ? [
                {
                  label: t("purchases.detail.due"),
                  numeric: true,
                  value: format.date(purchase.dueDate),
                },
              ]
            : []),
          {
            label: t("purchases.detail.merchandise"),
            value: purchase.receivedAt
              ? t("purchases.detail.receivedOn", {
                  date: format.instant(purchase.receivedAt, purchase.timeZone),
                })
              : t("purchases.detail.notReceived"),
          },
          ...(purchase.note ? [{ label: t("purchases.detail.note"), value: purchase.note }] : []),
        ]}
      />
      <Section title={t("purchases.detail.lines")}>
        <DataTable
          caption={t("purchases.detail.lines")}
          columns={[
            {
              id: "product",
              header: t("purchases.form.product"),
              meta: { primary: true },
              cell: ({ row: { original } }) => (
                <Text className="text-[13px]" numberOfLines={2}>
                  {original.productName}
                </Text>
              ),
            },
            {
              id: "quantity",
              header: t("purchases.form.quantity"),
              meta: { align: "end" },
              cell: ({ row: { original } }) => (
                <Text className="text-[13px] tabular-nums">
                  {quantityText(original.quantityMinorUnits, original.quantityPrecision)}
                </Text>
              ),
            },
            {
              id: "cost",
              header: t("purchases.form.unitCost"),
              meta: { align: "end" },
              cell: ({ row: { original } }) => (
                <MoneyText
                  currency={purchase.currency}
                  digits={purchase.currencyMinorUnitDigits}
                  minorUnits={original.unitCostMinorUnits}
                />
              ),
            },
            {
              id: "subtotal",
              header: t("purchases.form.subtotal"),
              meta: { align: "end", figure: true },
              cell: ({ row: { original } }) => (
                <MoneyText
                  currency={purchase.currency}
                  digits={purchase.currencyMinorUnitDigits}
                  minorUnits={original.subtotalMinorUnits}
                />
              ),
            },
          ]}
          data={purchase.lines}
          getRowId={(line) => line.id}
        />
      </Section>
      <Section title={t("purchases.detail.payments")}>
        {purchase.paymentTerms === "cash" ? (
          <Text className="text-sm text-muted-foreground">{t("purchases.detail.paidCash")}</Text>
        ) : payments.length === 0 ? (
          <Text className="text-sm text-muted-foreground">{t("purchases.detail.noPayments")}</Text>
        ) : (
          <DataTable
            caption={t("purchases.detail.payments")}
            columns={[
              {
                id: "date",
                header: t("dataTable.columns.date"),
                meta: { primary: true },
                cell: ({ row: { original } }) => (
                  <Text className="text-[13px] tabular-nums">
                    {t("purchases.detail.occurredAt", {
                      date: format.date(original.occurredLocalDate),
                      time: original.occurredLocalTime,
                    })}
                  </Text>
                ),
              },
              {
                id: "account",
                header: t("purchases.detail.paymentAccount"),
                cell: ({ row: { original } }) => (
                  <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                    {accountName(original.accountId)}
                  </Text>
                ),
              },
              {
                id: "reference",
                header: t("dataTable.columns.reference"),
                cell: ({ row: { original } }) => (
                  <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                    {original.reference ?? "—"}
                  </Text>
                ),
              },
              {
                id: "amount",
                header: t("dataTable.columns.amount"),
                meta: { align: "end", figure: true },
                cell: ({ row: { original } }) => (
                  <MoneyText
                    currency={original.currency}
                    digits={original.currencyMinorUnitDigits}
                    minorUnits={original.amountMinorUnits}
                  />
                ),
              },
            ]}
            data={payments}
            getRowId={(payment) => payment.id}
          />
        )}
      </Section>
      <SupplierPaymentDialog
        onOpenChange={setPaying}
        open={paying}
        purchaseId={purchase.id}
        returnFocusRef={menuTriggerRef}
      />
      <ConfirmDialog
        confirmLabel={t("purchases.detail.receiveConfirm")}
        description={t("purchases.detail.receiveDescription")}
        errorMessage={receive.state.phase === "failed" ? receive.state.message : undefined}
        onCancel={() => receive.onOpenChange(false)}
        onConfirm={() =>
          receive.confirm(() => ({
            idempotencyKey: Crypto.randomUUID(),
            occurredLocalDate: moment.date,
            occurredLocalTime: moment.time,
          }))
        }
        open={receive.open}
        phase={commandPhase(receive.state)}
        title={t("purchases.detail.receiveTitle")}
        uncertainDescription={t("purchases.detail.receiveUncertain")}
      >
        <MomentFields
          date={receive.command?.occurredLocalDate ?? moment.date}
          disabled={receive.state.phase === "pending" || receive.state.phase === "uncertain"}
          onDateChange={(value) => setMoment((current) => ({ ...current, date: value }))}
          onTimeChange={(value) => setMoment((current) => ({ ...current, time: value }))}
          time={receive.command?.occurredLocalTime ?? moment.time}
        />
      </ConfirmDialog>
      <ConfirmDialog
        confirmLabel={t("purchases.detail.voidConfirm")}
        description={t("purchases.detail.voidDescription")}
        destructive
        errorMessage={voidCommand.state.phase === "failed" ? voidCommand.state.message : undefined}
        onCancel={() => voidCommand.onOpenChange(false)}
        onConfirm={() =>
          voidCommand.confirm(() => {
            const trimmed = reason.trim();
            if (trimmed.length < 2 || trimmed.length > 240) {
              setReasonError(t("purchases.detail.voidReasonInvalid"));
              return null;
            }
            return { idempotencyKey: Crypto.randomUUID(), reason: trimmed };
          })
        }
        open={voidCommand.open}
        phase={commandPhase(voidCommand.state)}
        returnFocus={menuTriggerRef}
        title={t("purchases.detail.voidTitle")}
        uncertainDescription={t("purchases.detail.voidUncertain")}
      >
        <View className="gap-1">
          <Field
            editable={
              voidCommand.state.phase !== "pending" && voidCommand.state.phase !== "uncertain"
            }
            error={reasonError}
            label={t("purchases.detail.voidReasonLabel")}
            maxLength={240}
            onChangeText={(value) => {
              setReason(value);
              setReasonError(undefined);
            }}
            placeholder={t("purchases.detail.voidReasonPlaceholder")}
            value={voidCommand.command?.reason ?? reason}
          />
        </View>
      </ConfirmDialog>
    </Page>
  );
}
