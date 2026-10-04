import type { ApplyReceivablePaymentRequest, Business, Receivable } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type { Href } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { CommandReview } from "@/features/customers/command-review";
import { commandState } from "@/features/customers/command-state";
import { useRecordFormat } from "@/features/customers/format";
import { ScreenState } from "@/features/customers/screen-state";
import { currentLocalDateTime, toDecimalString } from "@/lib/money";
import { notify } from "@/lib/notify";

import { receivablesApi } from "./api";
import { CashAccountPickerDialog } from "./cash-account-picker";
import type { CashAccountChoice } from "./cash-account-source";
import { buildPaymentCommand, type PaymentDraft, type ReceivableDraftIssue } from "./draft";
import { invalidateReceivableMutation } from "./mutation-state";
import { PaymentForm, type PaymentFormErrors } from "./payment-form";
import { amountInputPlaceholder } from "./presentation";

type PaymentEditorProps = {
  /** Whether the latest read still accepts a payment; a command already under review is kept. */
  availability: "available" | "stale" | "unavailable";
  business: Business;
  cancelHref: Href;
  customerName: string;
  onConfirmed: () => void;
  onRetryRead: () => void;
  receivable: Receivable;
};

function issueMessage(t: TFunction, issue: ReceivableDraftIssue | undefined) {
  if (!issue) return undefined;
  if (issue === "cash-account") return t("receivables.validation.cashAccount");
  if (issue === "date") return t("receivables.validation.date");
  if (issue === "time") return t("receivables.validation.time");
  if (issue === "reference") return t("receivables.validation.reference");
  if (issue === "overpayment") return t("receivables.validation.overpayment");
  return t("receivables.validation.amount");
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
  const [account, setAccount] = useState<CashAccountChoice | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>(() => {
    const now = currentLocalDateTime(business.timeZone);
    return { amount: "", date: now.date, reference: "", time: now.time };
  });
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [command, setCommand] = useState<ApplyReceivablePaymentRequest | null>(null);
  const money = (minorUnits: string) =>
    format.money(minorUnits, receivable.currency, receivable.currencyMinorUnitDigits);
  const mutation = useMutation({
    mutationFn: ({
      command: next,
    }: {
      accountName: string;
      command: ApplyReceivablePaymentRequest;
    }) => receivablesApi.applyPayment(receivable.id, next),
    onSuccess: async ({ payment, receivable: confirmed }, { accountName }) => {
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
  const state = commandState(t, mutation, t("receivables.payment.conflict"));

  const prepareReview = () => {
    const result = buildPaymentCommand(
      draft,
      account,
      receivable.currencyMinorUnitDigits,
      receivable.outstandingMinorUnits,
      Crypto.randomUUID(),
    );
    setErrors({
      amount: issueMessage(t, result.issues.amount),
      cashAccount: issueMessage(t, result.issues.cashAccount),
      date: issueMessage(t, result.issues.date),
      reference: issueMessage(t, result.issues.reference),
      time: issueMessage(t, result.issues.time),
    });
    if (!("command" in result)) return;
    mutation.reset();
    setCommand(result.command);
  };

  if (!command && availability !== "available") {
    return (
      <ScreenState
        kind={availability === "stale" ? "error" : "unavailable"}
        onRetry={onRetryRead}
        width="form"
      />
    );
  }

  return (
    <Page width="form">
      <PageHeader
        description={t("receivables.payment.description", {
          charge: receivable.description,
          customer: customerName,
        })}
        title={t("receivables.payment.title")}
      />
      {command && account ? (
        <CommandReview
          confirmLabel={t("receivables.payment.confirm")}
          description={t("receivables.payment.reviewDescription")}
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
          onConfirm={() => mutation.mutate({ accountName: account.name, command })}
          onEdit={() => {
            setCommand(null);
            mutation.reset();
          }}
          state={state}
          title={t("receivables.payment.reviewTitle")}
        />
      ) : (
        <PaymentForm
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
        />
      )}
      <CashAccountPickerDialog
        businessId={business.id}
        onOpenChange={setPickerOpen}
        onSelect={(selection) => {
          setAccount(selection);
          setErrors((current) => ({ ...current, cashAccount: undefined }));
        }}
        open={pickerOpen}
        selectedId={account?.id ?? null}
      />
    </Page>
  );
}
