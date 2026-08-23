import type { CreateCustomerRequest, Customer, UpdateCustomerRequest } from "@pisto/contracts";
import { createCustomerRequestSchema, updateCustomerRequestSchema } from "@pisto/contracts";

export type CustomerDraftValues = {
  email: string;
  name: string;
  notes: string;
  phone: string;
};

export type CustomerDraftField = keyof CustomerDraftValues | "form";
export type CustomerDraftIssue = "email" | "name" | "no-changes" | "notes" | "phone";
export type CustomerDraftIssues = Partial<Record<CustomerDraftField, CustomerDraftIssue>>;

type DraftResult<T> = { command: T; issues: CustomerDraftIssues } | { issues: CustomerDraftIssues };

function issuesFrom(error: { issues: readonly { path: PropertyKey[] }[] }): CustomerDraftIssues {
  const issues: CustomerDraftIssues = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "name" || field === "phone" || field === "email" || field === "notes") {
      issues[field] = field;
    }
  }
  return issues;
}

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

export function customerValues(customer?: Customer): CustomerDraftValues {
  return {
    email: customer?.email ?? "",
    name: customer?.name ?? "",
    notes: customer?.notes ?? "",
    phone: customer?.phone ?? "",
  };
}

export function buildCreateCustomerCommand(
  values: CustomerDraftValues,
  idempotencyKey: string,
): DraftResult<CreateCustomerRequest> {
  const parsed = createCustomerRequestSchema.safeParse({
    idempotencyKey,
    name: values.name.trim(),
    phone: optionalText(values.phone),
    email: optionalText(values.email),
    notes: optionalText(values.notes),
  });
  if (!parsed.success) return { issues: issuesFrom(parsed.error) };
  return { command: parsed.data, issues: {} };
}

function changedOptionalValue(current: string | null, draft: string): string | null | undefined {
  const normalized = draft.trim() || null;
  return normalized === current ? undefined : normalized;
}

export function buildUpdateCustomerCommand(
  customer: Customer,
  values: CustomerDraftValues,
  idempotencyKey: string,
): DraftResult<UpdateCustomerRequest> {
  const normalizedName = values.name.trim();
  const command = {
    idempotencyKey,
    name: normalizedName === customer.name ? undefined : normalizedName,
    phone: changedOptionalValue(customer.phone, values.phone),
    email: changedOptionalValue(customer.email, values.email),
    notes: changedOptionalValue(customer.notes, values.notes),
  };
  const parsed = updateCustomerRequestSchema.safeParse(command);
  if (!parsed.success) {
    const issues = issuesFrom(parsed.error);
    if (Object.keys(issues).length === 0) issues.form = "no-changes";
    return { issues };
  }
  return { command: parsed.data, issues: {} };
}
