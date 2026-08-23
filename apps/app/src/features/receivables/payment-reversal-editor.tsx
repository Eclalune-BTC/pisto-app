import type { Business } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import type {
  ReceivablePayment,
  ReverseReceivablePaymentRequest,
} from "../../../../../packages/contracts/src/receivables";

import { receivablesApi } from "./api";
import {
  buildPaymentReversalCommand,
  type PaymentReversalDraft,
  type ReceivableDraftIssue,
} from "./draft";
import { financialMutationState, invalidateReceivableMutation } from "./mutation-state";
import { PaymentReversalForm } from "./payment-reversal-form";
import { PaymentReversalReview } from "./receivable-reviews";

type PaymentReversalEditorProps = {
  business: Business;
  cashAccountName: string;
  onBack: () => void;
  onConfirmed: () => void;
  payment: ReceivablePayment;
};

type ReversalErrors = Partial<Record<"date" | "reference" | "time", string>>;

function issueMessage(issue: ReceivableDraftIssue | undefined): string | undefined {
  if (!issue) return undefined;
  if (issue === "date") return copy.receivables.validation.date;
  if (issue === "time") return copy.receivables.validation.time;
  return copy.receivables.validation.reference;
}

export function PaymentReversalEditor({
  business,
  cashAccountName,
  onBack,
  onConfirmed,
  payment,
}: PaymentReversalEditorProps) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const now = currentLocalDateTime(business.timeZone);
  const [draft, setDraft] = useState<PaymentReversalDraft>({
    date: now.date,
    reference: "",
    time: now.time,
  });
  const [errors, setErrors] = useState<ReversalErrors>({});
  const [command, setCommand] = useState<ReverseReceivablePaymentRequest | null>(null);
  const mutation = useMutation({
    mutationFn: (nextCommand: ReverseReceivablePaymentRequest) =>
      receivablesApi.reversePayment(payment.id, nextCommand),
    onSuccess: async ({ receivable: confirmedReceivable }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId: business.id,
        customerId: confirmedReceivable.customerId,
        receivableId: confirmedReceivable.id,
      });
      onConfirmed();
    },
  });

  const prepareReview = () => {
    const result = buildPaymentReversalCommand(draft, Crypto.randomUUID());
    setErrors({
      date: issueMessage(result.issues.date),
      reference: issueMessage(result.issues.reference),
      time: issueMessage(result.issues.time),
    });
    if (!("command" in result)) return;
    setCommand(result.command);
    mutation.reset();
  };

  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} variant="ghost">
        <ArrowLeft color="#237A55" size={18} />
        <ButtonText variant="ghost">{copy.common.back}</ButtonText>
      </Button>
      <ScreenHeader
        description={copy.receivables.route.reversalDescription}
        title={copy.receivables.route.reversalTitle}
      />
      {command ? (
        <PaymentReversalReview
          amount={formatMinorUnits(
            payment.amountMinorUnits,
            payment.currency,
            payment.currencyMinorUnitDigits,
            locale,
          )}
          cashAccountName={cashAccountName}
          copy={copy.receivables.review}
          mutation={financialMutationState(mutation)}
          occurrence={`${command.occurredLocalDate} ${command.occurredLocalTime}`}
          onCancel={() => {
            setCommand(null);
            mutation.reset();
          }}
          onConfirm={() => mutation.mutate(command)}
          onRetrySameCommand={() => mutation.mutate(command)}
          originalPayment={`${payment.occurredLocalDate} ${payment.occurredLocalTime}`}
          reference={command.reference ?? null}
        />
      ) : (
        <PaymentReversalForm
          canReview={Boolean(draft.date && draft.time)}
          copy={copy.receivables.reversalForm}
          date={draft.date}
          errors={errors}
          onCancel={onBack}
          onChange={(field, value) => {
            setDraft((current) => ({ ...current, [field]: value }));
            setErrors((current) => ({ ...current, [field]: undefined }));
          }}
          onReview={prepareReview}
          reference={draft.reference}
          time={draft.time}
        />
      )}
    </Page>
  );
}
