import type {
  CreateCustomerRequest,
  Customer,
  CustomerResponse,
  UpdateCustomerRequest,
} from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type { Href } from "expo-router";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { DescriptionItem } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Text } from "@/components/ui/text";
import { notify } from "@/lib/notify";
import { customersApi } from "./api";
import { CommandReview } from "./command-review";
import { commandInFlight, type EditorAvailability } from "./command-state";
import { CustomerForm, type CustomerFormErrors } from "./customer-form";
import {
  buildCreateCustomerCommand,
  buildUpdateCustomerCommand,
  type CustomerDraftIssues,
  type CustomerDraftValues,
  customerValues,
} from "./draft";
import { customerQueryKeys } from "./queries";
import { useCommand } from "./use-command";
import { useFirstInvalidFocus } from "./use-first-invalid-focus";

type CustomerCommand = CreateCustomerRequest | UpdateCustomerRequest;

type CustomerEditorProps = {
  availability: EditorAvailability;
  businessId: string;
  cancelHref: Href;
  /** Present when editing; a new customer starts from empty values. */
  customer?: Customer;
  onConfirmed: (customer: Customer) => void;
  onRetryRead: () => void;
};

function fieldErrors(t: TFunction, issues: CustomerDraftIssues): CustomerFormErrors {
  return {
    email: issues.email ? t("customers.validation.email") : undefined,
    name: issues.name ? t("customers.validation.name") : undefined,
    notes: issues.notes ? t("customers.validation.notes") : undefined,
    phone: issues.phone ? t("customers.validation.phone") : undefined,
  };
}

function ChangedValue({ next, previous }: { next: string; previous: string | null }) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-0.5">
      <Text className="text-sm leading-5">{next}</Text>
      {previous ? (
        <Text className="text-xs leading-4 text-muted-foreground">
          {t("customers.editor.previous", { value: previous })}
        </Text>
      ) : null}
    </View>
  );
}

/** The fields the command sets; an edit also shows the value each one replaces. */
function reviewItems(
  t: TFunction,
  command: CustomerCommand,
  customer: Customer | undefined,
): DescriptionItem[] {
  const fields = [
    ["name", t("customers.fields.name")],
    ["phone", t("customers.fields.phone")],
    ["email", t("customers.fields.email")],
    ["notes", t("customers.fields.notes")],
  ] as const;
  return fields.flatMap(([field, label]) => {
    const value = command[field];
    if (value === undefined) return [];
    const next = value ?? t("customers.editor.cleared");
    return [
      {
        label,
        value: customer ? <ChangedValue next={next} previous={customer[field]} /> : next,
      },
    ];
  });
}

export function CustomerEditor({
  availability,
  businessId,
  cancelHref,
  customer,
  onConfirmed,
  onRetryRead,
}: CustomerEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const editing = customer !== undefined;
  const [values, setValues] = useState<CustomerDraftValues>(() => customerValues(customer));
  const [errors, setErrors] = useState<CustomerFormErrors>({});
  const [formError, setFormError] = useState<string>();
  const { containerRef, focusFirstInvalid } = useFirstInvalidFocus();
  // An edit is reviewed against the record it was prepared from, not a later refetch.
  const [review, setReview] = useState<{ command: CustomerCommand; previous?: Customer } | null>(
    null,
  );

  const { reset, send, state } = useCommand({
    conflictMessage: editing ? t("customers.editor.conflict") : undefined,
    keyOf: (next: CustomerCommand) => next.idempotencyKey,
    mutationFn: (next: CustomerCommand): Promise<CustomerResponse["data"]> =>
      customer
        ? customersApi.update(customer.id, next as UpdateCustomerRequest)
        : customersApi.create(next as CreateCustomerRequest),
    onConfirmed: async ({ customer: confirmed }) => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all(businessId) });
      notify.success(editing ? t("customers.editor.updated") : t("customers.editor.created"), {
        description: confirmed.name,
      });
      onConfirmed(confirmed);
    },
  });
  const stale = availability === "stale";

  const prepareReview = () => {
    if (stale) return;
    const idempotencyKey = Crypto.randomUUID();
    const result = customer
      ? buildUpdateCustomerCommand(customer, values, idempotencyKey)
      : buildCreateCustomerCommand(values, idempotencyKey);
    setErrors(fieldErrors(t, result.issues));
    setFormError(result.issues.form === "no-changes" ? t("customers.editor.noChanges") : undefined);
    if (!("command" in result)) {
      focusFirstInvalid();
      return;
    }
    reset();
    setReview({ command: result.command as CustomerCommand, previous: customer });
  };

  if (availability === "unavailable" && !commandInFlight(state)) {
    return <RouteState kind="unavailable" width="form" />;
  }

  return (
    <Page width="form">
      <PageHeader
        description={
          editing ? t("customers.editor.editDescription") : t("customers.editor.createDescription")
        }
        title={editing ? t("customers.editor.editTitle") : t("customers.editor.createTitle")}
      />
      {stale ? <StaleNotice onRetry={onRetryRead} /> : null}
      {review ? (
        <CommandReview
          confirmLabel={
            editing ? t("customers.editor.confirmEdit") : t("customers.editor.confirmCreate")
          }
          description={
            editing
              ? t("customers.editor.reviewEditDescription")
              : t("customers.editor.reviewCreateDescription")
          }
          items={reviewItems(t, review.command, review.previous)}
          onConfirm={() => send(review.command)}
          onEdit={() => {
            setReview(null);
            reset();
          }}
          stale={stale}
          state={state}
          title={t("customers.editor.reviewTitle")}
        />
      ) : (
        <View ref={containerRef}>
          <CustomerForm
            cancelHref={cancelHref}
            errors={errors}
            formError={formError}
            onChange={(field, value) => {
              setValues((current) => ({ ...current, [field]: value }));
              setErrors((current) => ({ ...current, [field]: undefined }));
              setFormError(undefined);
            }}
            onSubmit={prepareReview}
            reviewDisabled={stale}
            values={values}
          />
        </View>
      )}
    </Page>
  );
}
