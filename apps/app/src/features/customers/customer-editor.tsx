import type { CreateCustomerRequest, Customer, UpdateCustomerRequest } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { Text } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";

import { customersApi } from "./api";
import { customersReceivablesCopy as copy } from "./copy";
import { CustomerForm } from "./customer-form";
import { CustomerReview, type CustomerReviewField } from "./customer-review";
import {
  buildCreateCustomerCommand,
  buildUpdateCustomerCommand,
  type CustomerDraftIssues,
  type CustomerDraftValues,
  customerValues,
} from "./draft";
import { customerMutationState } from "./mutation-state";
import { customerQueryKeys } from "./queries";

type CustomerCommand = CreateCustomerRequest | UpdateCustomerRequest;

type CustomerEditorProps = {
  businessId: string;
  customer?: Customer;
  onBack: () => void;
  onConfirmed: (customerId: string) => void;
};

function issueMessages(
  issues: CustomerDraftIssues,
): Partial<Record<keyof CustomerDraftValues, string>> {
  return {
    email: issues.email ? copy.customers.validation.email : undefined,
    name: issues.name ? copy.customers.validation.name : undefined,
    notes: issues.notes ? copy.customers.validation.notes : undefined,
    phone: issues.phone ? copy.customers.validation.phone : undefined,
  };
}

function reviewFields(command: CustomerCommand): CustomerReviewField[] {
  const fields: CustomerReviewField[] = [];
  if (command.name !== undefined) {
    fields.push({ label: copy.customers.list.name, value: command.name });
  }
  for (const [field, label] of [
    ["phone", copy.customers.list.phone],
    ["email", copy.customers.list.email],
    ["notes", copy.customers.list.notes],
  ] as const) {
    const value = command[field];
    if (value !== undefined) {
      fields.push({
        label,
        value: value === null ? copy.common.clearValue : value,
      });
    }
  }
  return fields;
}

export function CustomerEditor({ businessId, customer, onBack, onConfirmed }: CustomerEditorProps) {
  const queryClient = useQueryClient();
  const editing = Boolean(customer);
  const [values, setValues] = useState<CustomerDraftValues>(() => customerValues(customer));
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerDraftValues, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [command, setCommand] = useState<CustomerCommand | null>(null);

  const mutation = useMutation({
    mutationFn: (nextCommand: CustomerCommand) =>
      customer
        ? customersApi.update(customer.id, nextCommand as UpdateCustomerRequest)
        : customersApi.create(nextCommand as CreateCustomerRequest),
    onSuccess: async ({ customer: confirmedCustomer }) => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all(businessId) });
      onConfirmed(confirmedCustomer.id);
    },
  });
  const mutationState = customerMutationState(mutation);

  const prepareReview = () => {
    const idempotencyKey = Crypto.randomUUID();
    const result = customer
      ? buildUpdateCustomerCommand(customer, values, idempotencyKey)
      : buildCreateCustomerCommand(values, idempotencyKey);
    setErrors(issueMessages(result.issues));
    setFormError(result.issues.form === "no-changes" ? copy.customers.editor.noChanges : undefined);
    if (!("command" in result)) return;
    setCommand(result.command as CustomerCommand);
    mutation.reset();
  };

  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} variant="ghost">
        <ArrowLeft color="#237A55" size={18} />
        <ButtonText variant="ghost">{copy.common.back}</ButtonText>
      </Button>
      <ScreenHeader
        description={
          editing ? copy.customers.editor.editDescription : copy.customers.editor.createDescription
        }
        title={editing ? copy.customers.editor.editTitle : copy.customers.editor.createTitle}
      />
      {command ? (
        <CustomerReview
          confirmLabel={
            editing ? copy.customers.editor.confirmEdit : copy.customers.editor.confirmCreate
          }
          fields={reviewFields(command)}
          mutation={mutationState}
          onConfirm={() => mutation.mutate(command)}
          onEdit={() => {
            setCommand(null);
            mutation.reset();
          }}
          onRetrySameRequest={() => mutation.mutate(command)}
          title={
            editing
              ? copy.customers.editor.reviewEditTitle
              : copy.customers.editor.reviewCreateTitle
          }
        />
      ) : (
        <>
          <CustomerForm
            copy={copy.customers.form}
            email={values.email}
            errors={errors}
            mutation={{ kind: "idle" }}
            name={values.name}
            notes={values.notes}
            onCancel={onBack}
            onChange={(field, value) => {
              setValues((current) => ({ ...current, [field]: value }));
              setErrors((current) => ({ ...current, [field]: undefined }));
              setFormError(undefined);
            }}
            onRetrySameRequest={() => undefined}
            onSubmit={prepareReview}
            phone={values.phone}
          />
          {formError ? (
            <Text accessibilityRole="alert" className="text-sm text-danger dark:text-[#FFBABA]">
              {formError}
            </Text>
          ) : null}
        </>
      )}
    </Page>
  );
}
