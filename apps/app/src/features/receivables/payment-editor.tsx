import type { ApplyReceivablePaymentRequest, Business, Receivable } from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type { Href } from "expo-router";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { CommandReview } from "@/components/command-review";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import {
  commandInFlight,
  commandPhase,
  type EditorAvailability,
} from "@/features/customers/command-state";
import { useRecordFormat } from "@/features/customers/format";
import { useCommand } from "@/features/customers/use-command";
import { currentLocalDateTime, toDecimalString } from "@/lib/money";
import { notify } from "@/lib/notify";
import { useFirstInvalidFocus } from "@/lib/use-first-invalid-focus";

import { receivablesApi } from "./api";
import { CashAccountPickerDialog } from "./cash-account-picker";
import type { CashAccountChoice } from "./cash-account-source";
import { buildPaymentCommand, type PaymentDraft, type ReceivableDraftIssue } from "./draft";
import { invalidateReceivableMutation } from "./mutation-state";
import { PaymentForm, type PaymentFormErrors } from "./payment-form";
import { amountInputPlaceholder } from "./presentation";

type PaymentEditorProps = {
  /** Whether the latest reads still accept a payment. */
  availability: EditorAvailability;
  business: Business;
  cancelHref: Href;
  customerName: string;
  onConfirmed: () => void;
  onRetryRead: () => void;
  receivable: Receivable;
};

/** The account name travels with the command so the confirmation names the account it used. */
type PaymentVariables = { accountName: string; command: ApplyReceivablePaymentRequest };

function issueMessage(t: TFunction, issue: ReceivableDraftIssue | undefined, digits: number) {
  if (!issue) return undefined;
  if (issue === "cash-account") return t("receivables.validation.cashAccount");
  if (issue === "date") return t("receivables.validation.date");
  if (issue === "time") return t("receivables.validation.time");
  if (issue === "reference") return t("receivables.validation.reference");
  if (issue === "overpayment") return t("receivables.validation.overpayment");
  return t("receivables.validation.amount", { count: digits });
}

export function PaymentEditor({
  availability,
  business,
  cancelHref,
  customerName,
  onConfirmed,
  onRetryRead,
  receivable,
}: PaymentEditorProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const accountFieldRef = useRef<View>(null);
  const { containerRef, focusFirstInvalid } = useFirstInvalidFocus();
  const [account, setAccount] = useState<CashAccountChoice | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(() => {
    const now = currentLocalDateTime(business.timeZone);
    return { amount: "", date: now.date, reference: "", time: now.time };
  });
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [command, setCommand] = useState<ApplyReceivablePaymentRequest | null>(null);
  const money = (minorUnits: string) =>
    format.money(minorUnits, receivable.currency, receivable.currencyMinorUnitDigits);
  const { reset, send, state } = useCommand({
    conflictMessage: t("receivables.payment.conflict"),
    keyOf: (variables: PaymentVariables) => variables.command.idempotencyKey,
    mutationFn: ({ command: next }: PaymentVariables) =>
      receivablesApi.applyPayment(receivable.id, next),
    onConfirmed: async ({ payment, receivable: confirmed }, { accountName }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId: business.id,
        customerId: confirmed.customerId,
      });
      notify.success(t("receivables.payment.done"), {
        description: t("receivables.payment.doneDescription", {
          account: accountName,
          amount: money(payment.amountMinorUnits),
        }),
      });
      onConfirmed();
    },
  });
  const stale = availability === "stale";

  const prepareReview = () => {
    if (stale) return;
    const result = buildPaymentCommand(
      draft,
      account,
      receivable.currencyMinorUnitDigits,
      receivable.outstandingMinorUnits,
      Crypto.randomUUID(),
    );
    const digits = receivable.currencyMinorUnitDigits;
    setErrors({
      amount: issueMessage(t, result.issues.amount, digits),
      cashAccount: issueMessage(t, result.issues.cashAccount, digits),
      date: issueMessage(t, result.issues.date, digits),
      reference: issueMessage(t, result.issues.reference, digits),
      time: issueMessage(t, result.issues.time, digits),
    });
    if (!("command" in result)) {
      focusFirstInvalid();
      return;
    }
    reset();
    setCommand(result.command);
  };

  if (availability === "unavailable" && !commandInFlight(state)) {
    return <RouteState kind="unavailable" width="form" />;
  }

  return (
    <Page width="form">
      <PageHeader
        description={t("receivables.payment.description", {
          charge: receivable.description,
          customer: customerName,
        })}
        title={
          command && account ? t("receivables.payment.reviewTitle") : t("receivables.payment.title")
        }
      />
      {stale ? <StaleNotice onRetry={onRetryRead} /> : null}
      {command && account ? (
        <CommandReview
          confirmLabel={t("receivables.payment.confirm")}
          note={t("receivables.payment.reviewDescription")}
          items={[
            {
              label: t("receivables.payment.amount"),
              numeric: true,
              value: money(command.amountMinorUnits),
            },
            { label: t("receivables.payment.account"), value: account.name },
            {
              label: t("receivables.payment.occurred"),
              numeric: true,
              value: t("receivables.payments.occurredAt", {
                date: format.date(command.occurredLocalDate),
                time: command.occurredLocalTime,
              }),
            },
            ...(command.reference
              ? [{ label: t("receivables.payment.referenceLabel"), value: command.reference }]
              : []),
          ]}
          onConfirm={() => send({ accountName: account.name, command })}
          onEdit={() => {
            setCommand(null);
            reset();
          }}
          disabled={stale}
          errorMessage={state.phase === "failed" ? state.message : undefined}
          phase={commandPhase(state)}
          uncertainDescription={state.phase === "uncertain" ? state.message : undefined}
          title={t("receivables.payment.reviewTitle")}
        />
      ) : (
        <View ref={containerRef}>
          <PaymentForm
            accountFieldRef={accountFieldRef}
            accountName={account?.name ?? null}
            amountPlaceholder={amountInputPlaceholder(receivable.currencyMinorUnitDigits)}
            cancelHref={cancelHref}
            currency={receivable.currency}
            draft={draft}
            errors={errors}
            onChange={(field, value) => {
              setDraft((current) => ({ ...current, [field]: value }));
              setErrors((current) => ({ ...current, [field]: undefined }));
            }}
            onChooseAccount={() => setPickerOpen(true)}
            onPayInFull={() => {
              setDraft((current) => ({
                ...current,
                amount: toDecimalString(
                  receivable.outstandingMinorUnits,
                  receivable.currencyMinorUnitDigits,
                ),
              }));
              setErrors((current) => ({ ...current, amount: undefined }));
            }}
            onReview={prepareReview}
            outstanding={money(receivable.outstandingMinorUnits)}
            reviewDisabled={stale}
          />
        </View>
      )}
      <CashAccountPickerDialog
        businessId={business.id}
        onOpenChange={setPickerOpen}
        onSelect={(selection) => {
          setAccount(selection);
          setErrors((current) => ({ ...current, cashAccount: undefined }));
        }}
        open={pickerOpen}
        returnFocusRef={accountFieldRef}
        selectedId={account?.id ?? null}
      />
    </Page>
  );
}
