import type { Business, Customer, PostReceivableRequest, Receivable } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { type Href, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { CommandReview } from "@/features/customers/command-review";
import { commandState } from "@/features/customers/command-state";
import { CustomerPickerDialog } from "@/features/customers/customer-picker";
import { customerContact, useRecordFormat } from "@/features/customers/format";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { ScreenState } from "@/features/customers/screen-state";
import { currentLocalDateTime } from "@/lib/money";
import { notify } from "@/lib/notify";
import { hasDeniedRead } from "@/lib/query-state";

import { receivablesApi } from "./api";
import {
  buildPostReceivableCommand,
  type PostReceivableDraft,
  type ReceivableDraftIssue,
} from "./draft";
import { invalidateReceivableMutation } from "./mutation-state";
import { amountInputPlaceholder } from "./presentation";
import { ReceivableForm, type ReceivableFormErrors } from "./receivable-form";

type ReceivableEditorProps = {
  business: Business;
  /** Where the charge was started from; cancelling and confirming both return there. */
  originHref: Href;
  /** Preselects the customer a charge was started from. */
  initialCustomerId?: string;
  onConfirmed: () => void;
};

function issueMessage(t: TFunction, issue: ReceivableDraftIssue | undefined) {
  if (!issue) return undefined;
  if (issue === "customer") return t("receivables.validation.customer");
  if (issue === "description") return t("receivables.validation.description");
  if (issue === "due-date") return t("receivables.validation.dueDate");
  if (issue === "date") return t("receivables.validation.date");
  return t("receivables.validation.amount");
}

export function ReceivableEditor({
  business,
  initialCustomerId,
  onConfirmed,
  originHref,
}: ReceivableEditorProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<PostReceivableDraft>(() => ({
    amount: "",
    description: "",
    dueDate: "",
    postedDate: currentLocalDateTime(business.timeZone).date,
  }));
  const [errors, setErrors] = useState<ReceivableFormErrors>({});
  const [command, setCommand] = useState<PostReceivableRequest | null>(null);
  const initial = useQuery({
    ...customerDetailQueryOptions(business.id, initialCustomerId),
    enabled: initialCustomerId !== undefined,
  });
  const initialCustomer = initial.data?.customer;
  const customer = picked ?? (initialCustomer?.status === "active" ? initialCustomer : null);
  // The preselected customer is only trusted while its read is confirmed.
  const initialUnconfirmed =
    picked === null &&
    initialCustomerId !== undefined &&
    (initial.isError || initial.fetchStatus === "paused");
  const customerNotice =
    picked !== null || initialCustomerId === undefined
      ? undefined
      : initialUnconfirmed
        ? t("receivables.form.customerUnavailable")
        : initialCustomer?.status === "archived"
          ? t("receivables.form.customerArchived")
          : undefined;

  const mutation = useMutation({
    mutationFn: ({ command: next }: { command: PostReceivableRequest; customerName: string }) =>
      receivablesApi.post(next),
    onSuccess: async ({ receivable }, { customerName }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId: business.id,
        customerId: receivable.customerId,
      });
      announce(receivable, customerName);
      onConfirmed();
    },
  });
  const state = commandState(t, mutation, t("receivables.form.conflict"));

  function announce(receivable: Receivable, customerName: string) {
    const href: Href = {
      pathname: "/operate/receivables/[receivableId]",
      params: { receivableId: receivable.id },
    };
    notify.success(t("receivables.form.posted"), {
      action: { label: t("receivables.form.viewPosted"), onPress: () => router.push(href) },
      description: t("receivables.form.postedDescription", {
        amount: format.money(
          receivable.originalMinorUnits,
          receivable.currency,
          receivable.currencyMinorUnitDigits,
        ),
        customer: customerName,
      }),
    });
  }

  const prepareReview = () => {
    if (initialUnconfirmed) {
      setErrors((current) => ({ ...current, customer: t("receivables.form.customerUnavailable") }));
      return;
    }
    const result = buildPostReceivableCommand(
      draft,
      customer,
      business.currencyMinorUnitDigits,
      Crypto.randomUUID(),
    );
    setErrors({
      amount: issueMessage(t, result.issues.amount),
      customer: issueMessage(t, result.issues.customer),
      description: issueMessage(t, result.issues.description),
      dueDate: issueMessage(t, result.issues.dueDate),
      postedDate: issueMessage(t, result.issues.postedDate),
    });
    if (!("command" in result)) return;
    mutation.reset();
    setCommand(result.command);
  };

  if (hasDeniedRead([initial])) return <ScreenState kind="denied" width="form" />;

  return (
    <Page width="form">
      <PageHeader
        description={t("receivables.form.pageDescription")}
        title={t("receivables.form.title")}
      />
      {command && customer ? (
        <CommandReview
          confirmLabel={t("receivables.form.confirm")}
          description={t("receivables.form.reviewDescription")}
          items={[
            { label: t("receivables.form.customer"), value: customer.name },
            {
              label: t("receivables.form.amount"),
              numeric: true,
              value: format.money(
                command.originalMinorUnits,
                business.currency,
                business.currencyMinorUnitDigits,
              ),
            },
            { label: t("receivables.form.descriptionLabel"), value: command.description },
            {
              label: t("receivables.form.postedDate"),
              numeric: true,
              value: format.date(command.postedDate),
            },
            {
              label: t("receivables.form.dueDate"),
              numeric: Boolean(command.dueDate),
              value: command.dueDate
                ? format.date(command.dueDate)
                : t("receivables.list.noDueDate"),
            },
          ]}
          onConfirm={() => mutation.mutate({ command, customerName: customer.name })}
          onEdit={() => {
            setCommand(null);
            mutation.reset();
          }}
          state={state}
          title={t("receivables.form.reviewTitle")}
        />
      ) : (
        <ReceivableForm
          amountPlaceholder={amountInputPlaceholder(business.currencyMinorUnitDigits)}
          cancelHref={originHref}
          currency={business.currency}
          customer={customer ? { detail: customerContact(customer), name: customer.name } : null}
          customerLoading={
            picked === null &&
            initialCustomerId !== undefined &&
            initial.isPending &&
            initial.fetchStatus !== "paused"
          }
          draft={draft}
          errors={{ ...errors, customer: errors.customer ?? customerNotice }}
          onChange={(field, value) => {
            setDraft((current) => ({ ...current, [field]: value }));
            setErrors((current) => ({ ...current, [field]: undefined }));
          }}
          onChooseCustomer={() => setPickerOpen(true)}
          onReview={prepareReview}
        />
      )}
      <CustomerPickerDialog
        businessId={business.id}
        onOpenChange={setPickerOpen}
        onSelect={(selection) => {
          setPicked(selection);
          setErrors((current) => ({ ...current, customer: undefined }));
        }}
        open={pickerOpen}
        selectedId={customer?.id ?? null}
        status="active"
      />
    </Page>
  );
}
