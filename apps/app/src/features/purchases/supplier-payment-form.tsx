import type {
  AssistantSupplierPaymentDraft,
  Business,
  CreateSupplierPaymentRequest,
  EntrySource,
  Purchase,
} from "@pisto/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { MomentFields } from "@/components/ui/moment-fields";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useFieldMarker } from "@/features/assistant/draft-slots";
import { useCapabilityAccess } from "@/features/customers/access";
import { useRecordFormat } from "@/features/customers/format";
import { PickerField } from "@/features/customers/picker-field";
import { readState } from "@/features/customers/read-state";
import { useCommand } from "@/features/customers/use-command";
import { CashAccountPickerDialog } from "@/features/receivables/cash-account-picker";
import { cn } from "@/lib/cn";
import { currentLocalDateTime, toDecimalString } from "@/lib/money";
import { notify } from "@/lib/notify";
import { purchasesApi } from "./api";
import {
  balanceAfterPayment,
  buildSupplierPaymentCommand,
  type SupplierPaymentDraft,
  type SupplierPaymentIssues,
} from "./draft";
import { OpenPurchasePickerDialog } from "./pickers";
import { invalidatePurchaseMutation, purchaseQueryOptions } from "./queries";

export type SupplierPaymentFormProps = {
  /** The purchase being paid; without it, and without a draft purchase, the user picks one. */
  purchaseId?: string;
  /** Limits the purchase choice to one supplier's open purchases. */
  supplierId?: string;
  /** An assistant draft: the form starts from what it resolved and the user confirms it. */
  draft?: AssistantSupplierPaymentDraft;
  entrySource: EntrySource;
  onSaved: (purchaseId: string) => void;
  onCancel: () => void;
  /** A sent payment whose outcome is pending or unknown must not be dismissed. */
  onBusyChange?: (busy: boolean) => void;
};

type PaymentVariables = {
  accountName: string;
  command: CreateSupplierPaymentRequest;
  purchaseId: string;
};

function initialDraft(
  timeZone: string,
  digits: number,
  draft: AssistantSupplierPaymentDraft | undefined,
): SupplierPaymentDraft {
  const now = currentLocalDateTime(timeZone);
  return {
    account: draft?.account ?? null,
    amount: draft?.amountMinorUnits ? toDecimalString(draft.amountMinorUnits, digits) : "",
    date: draft?.occurredLocalDate ?? now.date,
    reference: "",
    time: draft?.occurredLocalTime ?? now.time,
  };
}

export function SupplierPaymentForm(props: SupplierPaymentFormProps) {
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  if (!access.business) return null;
  return <PaymentFormBody {...props} business={access.business} canManage={access.canManage} />;
}

function PaymentFormBody({
  business,
  canManage,
  draft: assistantDraft,
  entrySource,
  onBusyChange,
  onCancel,
  onSaved,
  purchaseId: requestedPurchaseId,
  supplierId,
}: SupplierPaymentFormProps & { business: Business; canManage: boolean }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const amountMarker = useFieldMarker("amount");
  const accountMarker = useFieldMarker("account");
  const [chosenPurchase, setChosenPurchase] = useState<Purchase | null>(null);
  const purchaseId = requestedPurchaseId ?? assistantDraft?.purchase?.id ?? chosenPurchase?.id;
  const detail = useQuery({
    ...purchaseQueryOptions(business.id, purchaseId),
    enabled: purchaseId !== undefined,
  });
  const purchase = detail.data?.purchase;
  const digits = business.currencyMinorUnitDigits;
  const [draft, setDraft] = useState<SupplierPaymentDraft>(() =>
    initialDraft(business.timeZone, digits, assistantDraft),
  );
  const [issues, setIssues] = useState<SupplierPaymentIssues & { purchase?: boolean }>({});
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [purchasePickerOpen, setPurchasePickerOpen] = useState(false);
  const accountRef = useRef<View>(null);
  const purchaseRef = useRef<View>(null);
  const [sent, setSent] = useState<PaymentVariables | null>(null);
  const { send, state } = useCommand({
    keyOf: (variables: PaymentVariables) => variables.command.idempotencyKey,
    mutationFn: ({ command, purchaseId: target }: PaymentVariables) =>
      purchasesApi.purchases.pay(target, command),
    onConfirmed: async (result, { accountName }) => {
      await invalidatePurchaseMutation(queryClient, business.id);
      notify.success(t("purchases.payment.saved"), {
        description: t("purchases.payment.savedDescription", {
          account: accountName,
          amount: format.money(
            result.payment.amountMinorUnits,
            result.payment.currency,
            result.payment.currencyMinorUnitDigits,
          ),
        }),
      });
      onSaved(result.purchase.id);
    },
  });
  const busy = state.phase === "pending" || state.phase === "uncertain";
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const money = (minorUnits: string) =>
    format.money(minorUnits, business.currency, business.currencyMinorUnitDigits);
  const read = purchaseId ? readState([detail]) : null;
  const balance = purchase?.status === "posted" ? purchase.balanceMinorUnits : "0";
  const after = purchase ? balanceAfterPayment(balance, draft.amount, digits) : null;
  const change = (patch: Partial<SupplierPaymentDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setIssues((current) => {
      const next = { ...current };
      for (const field of Object.keys(patch)) delete next[field as keyof SupplierPaymentIssues];
      return next;
    });
  };
  const issueText = (issue: SupplierPaymentIssues[keyof SupplierPaymentIssues]) => {
    if (!issue) return undefined;
    if (issue === "overpayment") return t("purchases.payment.validation.overpayment");
    if (issue === "account") return t("purchases.payment.validation.account");
    if (issue === "date") return t("purchases.payment.validation.date");
    if (issue === "time") return t("purchases.payment.validation.time");
    if (issue === "reference") return t("purchases.payment.validation.reference");
    return t("purchases.payment.validation.amount");
  };
  const submit = () => {
    if (state.phase === "uncertain" && sent) {
      send(sent);
      return;
    }
    if (!purchase || !purchaseId) {
      setIssues({ purchase: true });
      return;
    }
    const result = buildSupplierPaymentCommand(draft, {
      balanceMinorUnits: balance,
      currencyMinorUnitDigits: digits,
      entrySource,
      idempotencyKey: Crypto.randomUUID(),
    });
    setIssues(result.issues);
    if (!("command" in result) || !draft.account) return;
    const variables = { accountName: draft.account.name, command: result.command, purchaseId };
    setSent(variables);
    send(variables);
  };
  const nothingOwed = purchase !== undefined && BigInt(balance) === 0n;

  return (
    <View className="gap-4">
      {requestedPurchaseId === undefined && assistantDraft?.purchase === undefined ? (
        <PickerField
          error={issues.purchase ? t("purchases.payment.validation.purchase") : undefined}
          label={t("purchases.payment.purchase")}
          onPress={() => !busy && setPurchasePickerOpen(true)}
          placeholder={t("purchases.payment.choosePurchase")}
          ref={purchaseRef}
          value={
            chosenPurchase
              ? chosenPurchase.invoiceNumber
                ? `${chosenPurchase.supplierName} · ${chosenPurchase.invoiceNumber}`
                : chosenPurchase.supplierName
              : undefined
          }
        />
      ) : null}
      {read?.kind === "loading" ? (
        <View accessibilityLabel={t("purchases.payment.loadingPurchase")} className="gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
        </View>
      ) : read && read.kind !== "ready" ? (
        <Alert
          action={
            <Button
              label={t("common.retry")}
              onPress={() => void detail.refetch()}
              size="sm"
              variant="outline"
            />
          }
          icon={TriangleAlert}
          variant="destructive"
        >
          <AlertDescription>{t("purchases.payment.purchaseUnavailable")}</AlertDescription>
        </Alert>
      ) : null}
      {purchase ? (
        <Text className="text-sm text-muted-foreground">
          {t("purchases.payment.description", {
            balance: money(balance),
            supplier: purchase.invoiceNumber
              ? `${purchase.supplierName} · ${purchase.invoiceNumber}`
              : purchase.supplierName,
          })}
        </Text>
      ) : null}
      {nothingOwed ? (
        <Alert icon={CircleAlert}>
          <AlertDescription>{t("purchases.payment.nothingOwed")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <View className="gap-1.5">
            <Field
              editable={!busy}
              error={issueText(issues.amount)}
              keyboardType="decimal-pad"
              label={t("purchases.payment.amount")}
              marker={amountMarker}
              onChangeText={(amount) => change({ amount })}
              placeholder={toDecimalString("0", digits)}
              trailing={<Text className="text-xs text-muted-foreground">{business.currency}</Text>}
              value={draft.amount}
            />
            {purchase ? (
              <Button
                className="self-start"
                disabled={busy}
                label={`${t("purchases.payment.all")} ${money(balance)}`}
                onPress={() => change({ amount: toDecimalString(balance, digits) })}
                size="sm"
                variant="outline"
              />
            ) : null}
          </View>
          <PickerField
            error={issueText(issues.account)}
            label={t("purchases.payment.account")}
            marker={accountMarker}
            onPress={() => !busy && setAccountPickerOpen(true)}
            placeholder={t("purchases.payment.chooseAccount")}
            ref={accountRef}
            value={draft.account?.name}
          />
          <MomentFields
            date={draft.date}
            dateError={issueText(issues.date)}
            dateLabel={t("purchases.payment.date")}
            disabled={busy}
            onDateChange={(date) => change({ date })}
            onTimeChange={(time) => change({ time })}
            time={draft.time}
            timeError={issueText(issues.time)}
            timeLabel={t("purchases.payment.time")}
          />
          <Field
            editable={!busy}
            error={issueText(issues.reference)}
            label={t("purchases.payment.reference")}
            maxLength={120}
            onChangeText={(reference) => change({ reference })}
            placeholder={t("purchases.payment.referencePlaceholder")}
            value={draft.reference}
          />
          {purchase ? (
            <View className="gap-1.5 rounded-md bg-muted px-3 py-2.5">
              <SummaryRow label={t("purchases.payment.currentBalance")} value={money(balance)} />
              <SummaryRow
                label={t("purchases.payment.paymentLine")}
                value={
                  after === null ? "—" : `−${money((BigInt(balance) - BigInt(after)).toString())}`
                }
              />
              <SummaryRow
                emphasis
                label={t("purchases.payment.balanceAfter")}
                value={after === null ? "—" : money(after)}
              />
            </View>
          ) : null}
        </>
      )}
      {state.phase === "uncertain" ? (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
          <AlertDescription>{t("purchases.payment.uncertain")}</AlertDescription>
        </Alert>
      ) : state.phase === "failed" ? (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-end gap-2">
        <Button disabled={busy} label={t("common.cancel")} onPress={onCancel} variant="outline" />
        <Button
          disabled={nothingOwed || state.phase === "pending" || !canManage}
          label={
            state.phase === "uncertain" ? t("purchases.payment.retry") : t("purchases.payment.save")
          }
          loading={state.phase === "pending"}
          onPress={submit}
        />
      </View>
      <CashAccountPickerDialog
        businessId={business.id}
        onOpenChange={setAccountPickerOpen}
        onSelect={(account) => change({ account: { id: account.id, name: account.name } })}
        open={accountPickerOpen}
        returnFocusRef={accountRef}
        selectedId={draft.account?.id ?? null}
      />
      <OpenPurchasePickerDialog
        businessId={business.id}
        onOpenChange={setPurchasePickerOpen}
        onSelect={(next) => {
          setChosenPurchase(next);
          setIssues((current) => ({ ...current, purchase: false }));
        }}
        open={purchasePickerOpen}
        returnFocusRef={purchaseRef}
        selectedId={chosenPurchase?.id ?? null}
        supplierId={supplierId}
      />
    </View>
  );
}

function SummaryRow({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text
        className={cn(
          "text-[13px]",
          emphasis ? "font-ui text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
      <Text
        className={cn(
          "text-[13px] tabular-nums",
          emphasis ? "font-ui text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </Text>
    </View>
  );
}
