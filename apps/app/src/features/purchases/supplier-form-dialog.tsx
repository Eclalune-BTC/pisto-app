import type { Supplier, UpdateSupplierRequest } from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCommand } from "@/features/customers/use-command";
import { notify } from "@/lib/notify";

import { purchasesApi } from "./api";
import { invalidatePurchaseMutation } from "./queries";

type SupplierFields = {
  contactName: string;
  creditDays: string;
  email: string;
  name: string;
  notes: string;
  phone: string;
  taxId: string;
};

type FieldIssue = "creditDays" | "email" | "name" | "tooLong";

const fieldLimits = {
  contactName: 120,
  email: 254,
  name: 120,
  notes: 1_000,
  phone: 40,
  taxId: 40,
} as const;

function fieldsOf(supplier: Supplier | null): SupplierFields {
  return {
    contactName: supplier?.contactName ?? "",
    creditDays: supplier?.creditDays === null || !supplier ? "" : String(supplier.creditDays),
    email: supplier?.email ?? "",
    name: supplier?.name ?? "",
    notes: supplier?.notes ?? "",
    phone: supplier?.phone ?? "",
    taxId: supplier?.taxId ?? "",
  };
}

/** Trimmed values with their issues; an empty optional field is absent. */
export function readSupplierFields(fields: SupplierFields): {
  issues: Partial<Record<keyof SupplierFields, FieldIssue>>;
  values: {
    contactName: string | null;
    creditDays: number | null;
    email: string | null;
    name: string;
    notes: string | null;
    phone: string | null;
    taxId: string | null;
  };
} {
  const issues: Partial<Record<keyof SupplierFields, FieldIssue>> = {};
  const optional = (key: keyof typeof fieldLimits) => {
    const value = fields[key].trim();
    if (value.length > fieldLimits[key]) issues[key] = "tooLong";
    return value.length > 0 ? value : null;
  };
  const name = fields.name.trim();
  if (name.length < 1 || name.length > fieldLimits.name) issues.name = "name";
  const email = optional("email");
  if (email !== null && !issues.email && !z.string().email().safeParse(email).success) {
    issues.email = "email";
  }
  const creditText = fields.creditDays.trim();
  let creditDays: number | null = null;
  if (creditText.length > 0) {
    creditDays = /^\d{1,3}$/.test(creditText) ? Number(creditText) : Number.NaN;
    if (!Number.isInteger(creditDays) || creditDays > 365) issues.creditDays = "creditDays";
  }
  return {
    issues,
    values: {
      contactName: optional("contactName"),
      creditDays,
      email,
      name,
      notes: optional("notes"),
      phone: optional("phone"),
      taxId: optional("taxId"),
    },
  };
}

type SupplierFormDialogProps = {
  businessId: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (supplier: Supplier) => void;
  open: boolean;
  /** The supplier being edited; null creates a new one. */
  supplier: Supplier | null;
};

type SupplierVariables =
  | { kind: "create"; command: Parameters<typeof purchasesApi.suppliers.create>[0] }
  | { kind: "update"; command: UpdateSupplierRequest; supplierId: string };

export function SupplierFormDialog(props: SupplierFormDialogProps) {
  // Each opening starts from the record as it is now.
  return props.open ? <SupplierFormDialogBody {...props} /> : null;
}

function SupplierFormDialogBody({
  businessId,
  onOpenChange,
  onSaved,
  open,
  supplier,
}: SupplierFormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<SupplierFields>(() => fieldsOf(supplier));
  const [issues, setIssues] = useState<Partial<Record<keyof SupplierFields, FieldIssue>>>({});
  const [noChanges, setNoChanges] = useState(false);
  const [sent, setSent] = useState<SupplierVariables | null>(null);
  const { send, state } = useCommand({
    keyOf: (variables: SupplierVariables) => variables.command.idempotencyKey,
    mutationFn: (variables: SupplierVariables) =>
      variables.kind === "create"
        ? purchasesApi.suppliers.create(variables.command)
        : purchasesApi.suppliers.update(variables.supplierId, variables.command),
    onConfirmed: async (result, variables) => {
      await invalidatePurchaseMutation(queryClient, businessId);
      notify.success(
        variables.kind === "create"
          ? t("purchases.supplierForm.created")
          : t("purchases.supplierForm.updated"),
        { description: result.supplier.name },
      );
      onSaved?.(result.supplier);
      onOpenChange(false);
    },
  });
  const busy = state.phase === "pending" || state.phase === "uncertain";
  const issueText = (issue: FieldIssue | undefined) =>
    issue ? t(`purchases.supplierForm.validation.${issue}`) : undefined;
  const change = (key: keyof SupplierFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setIssues((current) => ({ ...current, [key]: undefined }));
    setNoChanges(false);
  };
  const submit = () => {
    if (state.phase === "uncertain" && sent) {
      send(sent);
      return;
    }
    const read = readSupplierFields(fields);
    setIssues(read.issues);
    if (Object.keys(read.issues).length > 0) return;
    const idempotencyKey = Crypto.randomUUID();
    let variables: SupplierVariables;
    if (!supplier) {
      const { values } = read;
      variables = {
        kind: "create",
        command: {
          idempotencyKey,
          name: values.name,
          ...(values.contactName ? { contactName: values.contactName } : {}),
          ...(values.phone ? { phone: values.phone } : {}),
          ...(values.email ? { email: values.email } : {}),
          ...(values.taxId ? { taxId: values.taxId } : {}),
          ...(values.creditDays !== null ? { creditDays: values.creditDays } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        },
      };
    } else {
      const changes: Omit<UpdateSupplierRequest, "idempotencyKey"> = {};
      const { values } = read;
      if (values.name !== supplier.name) changes.name = values.name;
      for (const key of ["contactName", "phone", "email", "taxId", "notes"] as const) {
        if (values[key] !== supplier[key]) changes[key] = values[key];
      }
      if (values.creditDays !== supplier.creditDays) changes.creditDays = values.creditDays;
      if (Object.keys(changes).length === 0) {
        setNoChanges(true);
        return;
      }
      variables = {
        kind: "update",
        supplierId: supplier.id,
        command: { idempotencyKey, ...changes },
      };
    }
    setSent(variables);
    send(variables);
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-h-[92%] gap-3 p-4 sm:max-w-lg web:w-[32rem]" hideClose={busy}>
        <DialogHeader className="pr-8">
          <DialogTitle>
            {supplier
              ? t("purchases.supplierForm.editTitle")
              : t("purchases.supplierForm.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("purchases.supplierForm.description")}</DialogDescription>
        </DialogHeader>
        <ScrollView keyboardShouldPersistTaps="handled">
          <View className="gap-3">
            <Field
              autoFocus
              editable={!busy}
              error={issueText(issues.name)}
              label={t("purchases.supplierForm.name")}
              maxLength={fieldLimits.name}
              onChangeText={(value) => change("name", value)}
              placeholder={t("purchases.supplierForm.namePlaceholder")}
              value={fields.name}
            />
            <View className="gap-3 sm:flex-row">
              <View className="min-w-0 flex-1">
                <Field
                  editable={!busy}
                  error={issueText(issues.contactName)}
                  label={t("purchases.supplierForm.contactName")}
                  maxLength={fieldLimits.contactName}
                  onChangeText={(value) => change("contactName", value)}
                  value={fields.contactName}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Field
                  editable={!busy}
                  error={issueText(issues.phone)}
                  keyboardType="phone-pad"
                  label={t("purchases.supplierForm.phone")}
                  maxLength={fieldLimits.phone}
                  onChangeText={(value) => change("phone", value)}
                  value={fields.phone}
                />
              </View>
            </View>
            <Field
              autoCapitalize="none"
              editable={!busy}
              error={issueText(issues.email)}
              keyboardType="email-address"
              label={t("purchases.supplierForm.email")}
              maxLength={fieldLimits.email}
              onChangeText={(value) => change("email", value)}
              value={fields.email}
            />
            <View className="gap-3 sm:flex-row">
              <View className="min-w-0 flex-1">
                <Field
                  editable={!busy}
                  error={issueText(issues.taxId)}
                  label={t("purchases.supplierForm.taxId")}
                  maxLength={fieldLimits.taxId}
                  onChangeText={(value) => change("taxId", value)}
                  value={fields.taxId}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Field
                  description={t("purchases.supplierForm.creditDaysHint")}
                  editable={!busy}
                  error={issueText(issues.creditDays)}
                  keyboardType="number-pad"
                  label={t("purchases.supplierForm.creditDays")}
                  maxLength={3}
                  onChangeText={(value) => change("creditDays", value)}
                  value={fields.creditDays}
                />
              </View>
            </View>
            <View className="gap-2">
              <Label nativeID="supplier-notes-label">{t("purchases.supplierForm.notes")}</Label>
              <Textarea
                aria-labelledby="supplier-notes-label"
                editable={!busy}
                maxLength={fieldLimits.notes}
                onChangeText={(value) => change("notes", value)}
                placeholder={t("purchases.supplierForm.notesPlaceholder")}
                value={fields.notes}
              />
              {issues.notes ? (
                <Alert icon={CircleAlert} variant="destructive">
                  <AlertDescription>{issueText(issues.notes)}</AlertDescription>
                </Alert>
              ) : null}
            </View>
            {noChanges ? (
              <Alert icon={CircleAlert}>
                <AlertDescription>{t("purchases.supplierForm.noChanges")}</AlertDescription>
              </Alert>
            ) : null}
            {state.phase === "uncertain" ? (
              <Alert icon={TriangleAlert} variant="warning">
                <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
                <AlertDescription>{t("purchases.supplierForm.uncertain")}</AlertDescription>
              </Alert>
            ) : state.phase === "failed" ? (
              <Alert icon={CircleAlert} variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <View className="flex-row flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                disabled={busy}
                label={t("common.cancel")}
                onPress={() => onOpenChange(false)}
                variant="outline"
              />
              <Button
                disabled={state.phase === "pending"}
                label={
                  state.phase === "uncertain"
                    ? t("common.retrySameConfirmation")
                    : t("purchases.supplierForm.save")
                }
                loading={state.phase === "pending"}
                onPress={submit}
              />
            </View>
          </View>
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
