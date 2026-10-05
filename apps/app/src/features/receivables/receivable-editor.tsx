import type { Business, Customer, PostReceivableRequest, Receivable } from "@pisto/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { type Href, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { CommandReview } from "@/features/customers/command-review";
import { CustomerPickerDialog } from "@/features/customers/customer-picker";
import { customerContact, useRecordFormat } from "@/features/customers/format";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { useCommand } from "@/features/customers/use-command";
import { useFirstInvalidFocus } from "@/features/customers/use-first-invalid-focus";
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

type ChargeReview = { command: PostReceivableRequest; customerName: string };

type ReceivableEditorProps = {
  business: Business;
  /** Where the charge was started from; cancelling and confirming both return there. */
  originHref: Href;
  /** Preselects the customer a charge was started from. */
  initialCustomerId?: string;
  onConfirmed: () => void;
  onRetryRead: () => void;
  /** Access could not be refreshed; new reviews and first sends wait. */
  stale: boolean;
};

function issueMessage(t: TFunction, issue: ReceivableDraftIssue | undefined, digits: number) {
  if (!issue) return undefined;
  if (issue === "customer") return t("receivables.validation.customer");
  if (issue === "description") return t("receivables.validation.description");
  if (issue === "due-date") return t("receivables.validation.dueDate");
  if (issue === "date") return t("receivables.validation.date");
  return t("receivables.validation.amount", { count: digits });
}

export function ReceivableEditor({
  business,
  initialCustomerId,
  onConfirmed,
  onRetryRead,
  originHref,
  stale,
}: ReceivableEditorProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const customerFieldRef = useRef<View>(null);
  const { containerRef, focusFirstInvalid } = useFirstInvalidFocus();
  const [picked, setPicked] = useState<Customer | null>(null);
  const [draft, setDraft] = useState<PostReceivableDraft>(() => ({
    amount: "",
    description: "",
    dueDate: "",
    postedDate: currentLocalDateTime(business.timeZone).date,
  }));
  const [errors, setErrors] = useState<ReceivableFormErrors>({});
  // The reviewed command keeps the customer it was built for, whatever later reads return.
  const [review, setReview] = useState<ChargeReview | null>(null);
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

  const { reset, send, state } = useCommand({
    conflictMessage: t("receivables.form.conflict"),
    keyOf: ({ command }: ChargeReview) => command.idempotencyKey,
    mutationFn: ({ command }: ChargeReview) => receivablesApi.post(command),
    onConfirmed: async ({ receivable }, { customerName }) => {
      await invalidateReceivableMutation(queryClient, {
        businessId: business.id,
        customerId: receivable.customerId,
      });
      announce(receivable, customerName);
      onConfirmed();
    },
  });

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
    if (stale) return;
    if (initialUnconfirmed) {
      setErrors((current) => ({ ...current, customer: t("receivables.form.customerUnavailable") }));
      focusFirstInvalid();
      return;
    }
    const result = buildPostReceivableCommand(
      draft,
      customer,
      business.currencyMinorUnitDigits,
      Crypto.randomUUID(),
    );
    const digits = business.currencyMinorUnitDigits;
    setErrors({
      amount: issueMessage(t, result.issues.amount, digits),
      customer: issueMessage(t, result.issues.customer, digits),
      description: issueMessage(t, result.issues.description, digits),
      dueDate: issueMessage(t, result.issues.dueDate, digits),
      postedDate: issueMessage(t, result.issues.postedDate, digits),
    });
    if (!("command" in result) || !customer) {
      focusFirstInvalid();
      return;
    }
    reset();
    setReview({ command: result.command, customerName: customer.name });
  };

  if (hasDeniedRead([initial])) return <RouteState kind="denied" width="form" />;

  return (
    <Page width="form">
      <PageHeader
        description={t("receivables.form.pageDescription")}
        title={t("receivables.form.title")}
      />
      {stale || (review && initialUnconfirmed) ? (
        <StaleNotice
          onRetry={() => {
            onRetryRead();
            void initial.refetch();
          }}
        />
      ) : null}
      {review ? (
        <CommandReview
          confirmLabel={t("receivables.form.confirm")}
          description={t("receivables.form.reviewDescription")}
          items={[
            { label: t("receivables.form.customer"), value: review.customerName },
            {
              label: t("receivables.form.amount"),
              numeric: true,
              value: format.money(
                review.command.originalMinorUnits,
                business.currency,
                business.currencyMinorUnitDigits,
              ),
            },
            { label: t("receivables.form.descriptionLabel"), value: review.command.description },
            {
              label: t("receivables.form.postedDate"),
              numeric: true,
              value: format.date(review.command.postedDate),
            },
            {
              label: t("receivables.form.dueDate"),
              numeric: Boolean(review.command.dueDate),
              value: review.command.dueDate
                ? format.date(review.command.dueDate)
                : t("receivables.list.noDueDate"),
            },
          ]}
          onConfirm={() => send(review)}
          onEdit={() => {
            setReview(null);
            reset();
          }}
          stale={stale || initialUnconfirmed}
          state={state}
          title={t("receivables.form.reviewTitle")}
        />
      ) : (
        <View ref={containerRef}>
          <ReceivableForm
            amountPlaceholder={amountInputPlaceholder(business.currencyMinorUnitDigits)}
            cancelHref={originHref}
            currency={business.currency}
            customer={customer ? { detail: customerContact(customer), name: customer.name } : null}
            customerFieldRef={customerFieldRef}
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
            reviewDisabled={stale}
          />
        </View>
      )}
      <CustomerPickerDialog
        businessId={business.id}
        freshChoiceOnly
        onOpenChange={setPickerOpen}
        onSelect={(selection) => {
          setPicked(selection);
          setErrors((current) => ({ ...current, customer: undefined }));
        }}
        open={pickerOpen}
        returnFocusRef={customerFieldRef}
        selectedId={customer?.id ?? null}
        status="active"
      />
    </Page>
  );
}
