import type {
  Business,
  ReceivablePayment,
  ReverseReceivablePaymentRequest,
} from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type { Href } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { CommandReview } from "@/features/customers/command-review";
import { commandState } from "@/features/customers/command-state";
import { useRecordFormat } from "@/features/customers/format";
import { ScreenState } from "@/features/customers/screen-state";
import { currentLocalDateTime } from "@/lib/money";
import { notify } from "@/lib/notify";

import { receivablesApi } from "./api";
import {
  buildPaymentReversalCommand,
  type PaymentReversalDraft,
  type ReceivableDraftIssue,
} from "./draft";
import { invalidateReceivableMutation } from "./mutation-state";
import { PaymentReversalForm, type PaymentReversalFormErrors } from "./payment-reversal-form";

type PaymentReversalEditorProps = {
  accountName: string;
  /** Whether the latest read still accepts a reversal; a command already under review is kept. */
  availability: "available" | "stale" | "unavailable";
  business: Business;
  cancelHref: Href;
  onConfirmed: () => void;
  onRetryRead: () => void;
  payment: ReceivablePayment;
};

function issueMessage(t: TFunction, issue: ReceivableDraftIssue | undefined) {
  if (!issue) return undefined;
  if (issue === "date") return t("receivables.validation.date");
  if (issue === "time") return t("receivables.validation.time");
  return t("receivables.validation.reference");
}

export function PaymentReversalEditor({
  accountName,
  availability,
  business,
  cancelHref,
  onConfirmed,
  onRetryRead,
  payment,
}: PaymentReversalEditorProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<PaymentReversalDraft>(() => {
    const now = currentLocalDateTime(business.timeZone);
    return { date: now.date, reference: "", time: now.time };
  });
  const [errors, setErrors] = useState<PaymentReversalFormErrors>({});
  const [command, setCommand] = useState<ReverseReceivablePaymentRequest | null>(null);
  const amount = format.money(
    payment.amountMinorUnits,
    payment.currency,
    payment.currencyMinorUnitDigits,
  );
  const mutation = useMutation({
    mutationFn: (next: ReverseReceivablePaymentRequest) =>
      receivablesApi.reversePayment(payment.id, next),
    onSuccess: async ({ receivable }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId: business.id,
        customerId: receivable.customerId,
      });
      notify.success(t("receivables.reversal.done"), {
        description: t("receivables.reversal.doneDescription", { amount, account: accountName }),
      });
      onConfirmed();
    },
  });
  const state = commandState(t, mutation, t("receivables.reversal.conflict"));

  const prepareReview = () => {
    const result = buildPaymentReversalCommand(draft, Crypto.randomUUID());
    setErrors({
      date: issueMessage(t, result.issues.date),
      reference: issueMessage(t, result.issues.reference),
      time: issueMessage(t, result.issues.time),
    });
    if (!("command" in result)) return;
    mutation.reset();
    setCommand(result.command);
  };

  const original = [
    {
      label: t("receivables.reversal.originalOccurred"),
      numeric: true,
      value: t("receivables.payments.occurredAt", {
        date: format.date(payment.occurredLocalDate),
        time: payment.occurredLocalTime,
      }),
    },
    { label: t("receivables.reversal.amount"), numeric: true, value: amount },
    { label: t("receivables.reversal.account"), value: accountName },
    ...(payment.reference
      ? [{ label: t("receivables.reversal.originalReference"), value: payment.reference }]
      : []),
  ];

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
        description={t("receivables.reversal.description")}
        title={t("receivables.reversal.title")}
      />
      {command ? (
        <CommandReview
          confirmLabel={t("receivables.reversal.confirm")}
          description={t("receivables.reversal.reviewDescription")}
          destructive
          items={[
            ...original,
            {
              label: t("receivables.reversal.occurred"),
              numeric: true,
              value: t("receivables.payments.occurredAt", {
                date: format.date(command.occurredLocalDate),
                time: command.occurredLocalTime,
              }),
            },
            ...(command.reference
              ? [{ label: t("receivables.reversal.referenceLabel"), value: command.reference }]
              : []),
          ]}
          onConfirm={() => mutation.mutate(command)}
          onEdit={() => {
            setCommand(null);
            mutation.reset();
          }}
          state={state}
          title={t("receivables.reversal.reviewTitle")}
        />
      ) : (
        <>
          <Section title={t("receivables.reversal.originalSection")}>
            <DescriptionList items={original} />
          </Section>
          <PaymentReversalForm
            cancelHref={cancelHref}
            draft={draft}
            errors={errors}
            onChange={(field, value) => {
              setDraft((current) => ({ ...current, [field]: value }));
              setErrors((current) => ({ ...current, [field]: undefined }));
            }}
            onReview={prepareReview}
          />
        </>
      )}
    </Page>
  );
}
