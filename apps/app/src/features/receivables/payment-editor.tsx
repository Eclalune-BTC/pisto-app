import type { Business } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { ApplyReceivablePaymentRequest, Receivable } from "@pisto/contracts";

import { receivablesApi } from "./api";
import { CashAccountPicker } from "./cash-account-picker";
import { type CashAccountChoice, cashAccountChoicesQueryOptions } from "./cash-account-source";
import { buildPaymentCommand, type PaymentDraft, type ReceivableDraftIssue } from "./draft";
import { financialMutationState, invalidateReceivableMutation } from "./mutation-state";
import { PaymentForm } from "./payment-form";
import { amountInputPlaceholder } from "./presentation";
import { PaymentReview } from "./receivable-reviews";

type PaymentEditorProps = {
  business: Business;
  onBack: () => void;
  onConfirmed: () => void;
  receivable: Receivable;
};

type PaymentErrors = Partial<
  Record<"amount" | "cashAccount" | "date" | "reference" | "time", string>
>;

function issueMessage(issue: ReceivableDraftIssue | undefined): string | undefined {
  if (!issue) return undefined;
  const validation = copy.receivables.validation;
  if (issue === "cash-account") return validation.cashAccount;
  if (issue === "date") return validation.date;
  if (issue === "time") return validation.time;
  if (issue === "reference") return validation.reference;
  if (issue === "overpayment") return validation.overpayment;
  return validation.amount;
}

export function PaymentEditor({ business, onBack, onConfirmed, receivable }: PaymentEditorProps) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const now = currentLocalDateTime(business.timeZone);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CashAccountChoice | null>(null);
  const [draft, setDraft] = useState<PaymentDraft>({
    amount: "",
    date: now.date,
    reference: "",
    time: now.time,
  });
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [command, setCommand] = useState<ApplyReceivablePaymentRequest | null>(null);
  const accounts = useInfiniteQuery(cashAccountChoicesQueryOptions(business.id, "active"));
  const mutation = useMutation({
    mutationFn: (nextCommand: ApplyReceivablePaymentRequest) =>
      receivablesApi.applyPayment(receivable.id, nextCommand),
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
    if (accounts.isError || accounts.fetchStatus === "paused") {
      setErrors((current) => ({
        ...current,
        cashAccount: copy.common.unavailableDescription,
      }));
      return;
    }
    const result = buildPaymentCommand(
      draft,
      selectedAccount,
      receivable.currencyMinorUnitDigits,
      receivable.outstandingMinorUnits,
      Crypto.randomUUID(),
    );
    setErrors({
      amount: issueMessage(result.issues.amount),
      cashAccount: issueMessage(result.issues.cashAccount),
      date: issueMessage(result.issues.date),
      reference: issueMessage(result.issues.reference),
      time: issueMessage(result.issues.time),
    });
    if (!("command" in result)) return;
    setCommand(result.command);
    mutation.reset();
  };

  if (pickerOpen) {
    return (
      <Page width="form">
        <CashAccountPicker
          hasNextPage={Boolean(accounts.hasNextPage)}
          isError={accounts.isError}
          isLoading={accounts.isPending && accounts.fetchStatus !== "paused"}
          isLoadingMore={accounts.isFetchingNextPage}
          isOffline={accounts.fetchStatus === "paused"}
          items={accounts.data?.pages.flatMap((page) => page.items) ?? []}
          onBack={() => setPickerOpen(false)}
          onLoadMore={() => accounts.fetchNextPage()}
          onRetry={() => accounts.refetch()}
          onSelect={(account) => {
            setSelectedAccount(account);
            setErrors((current) => ({ ...current, cashAccount: undefined }));
            setPickerOpen(false);
          }}
          selectedAccountId={selectedAccount?.id ?? null}
        />
      </Page>
    );
  }

  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} variant="ghost">
        <ArrowLeft color="#237A55" size={18} />
        <ButtonText variant="ghost">{copy.common.back}</ButtonText>
      </Button>
      <ScreenHeader
        description={copy.receivables.route.paymentDescription}
        title={copy.receivables.route.paymentTitle}
      />
      {command && selectedAccount ? (
        <PaymentReview
          amount={formatMinorUnits(
            command.amountMinorUnits,
            receivable.currency,
            receivable.currencyMinorUnitDigits,
            locale,
          )}
          cashAccountName={selectedAccount.name}
          copy={copy.receivables.review}
          mutation={financialMutationState(mutation)}
          occurrence={`${command.occurredLocalDate} ${command.occurredLocalTime}`}
          onCancel={() => {
            setCommand(null);
            mutation.reset();
          }}
          onConfirm={() => mutation.mutate(command)}
          onRetrySameCommand={() => mutation.mutate(command)}
          reference={command.reference ?? null}
        />
      ) : (
        <PaymentForm
          amount={draft.amount}
          canReview={Boolean(
            selectedAccount &&
              draft.amount &&
              draft.date &&
              draft.time &&
              !accounts.isError &&
              accounts.fetchStatus !== "paused",
          )}
          copy={{
            ...copy.receivables.paymentForm,
            amountPlaceholder: amountInputPlaceholder(receivable.currencyMinorUnitDigits),
          }}
          date={draft.date}
          errors={errors}
          onCancel={onBack}
          onChange={(field, value) => {
            setDraft((current) => ({ ...current, [field]: value }));
            setErrors((current) => ({ ...current, [field]: undefined }));
          }}
          onChooseCashAccount={() => setPickerOpen(true)}
          onReview={prepareReview}
          reference={draft.reference}
          selectedCashAccountName={selectedAccount?.name ?? null}
          time={draft.time}
        />
      )}
    </Page>
  );
}
