import type {
  AssistantPurchaseDraft,
  Business,
  CreatePurchaseRequest,
  EntrySource,
  PurchasePaymentTerms,
} from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { CircleAlert, PackagePlus, Plus, Trash2, TriangleAlert } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { TimeField } from "@/components/ui/time-field";
import { useCapabilityAccess } from "@/features/customers/access";
import { useRecordFormat } from "@/features/customers/format";
import { PickerField } from "@/features/customers/picker-field";
import { useCommand } from "@/features/customers/use-command";
import { CashAccountPickerDialog } from "@/features/receivables/cash-account-picker";
import { cn } from "@/lib/cn";
import { currentLocalDateTime, toDecimalString } from "@/lib/money";
import { notify } from "@/lib/notify";

import { purchasesApi } from "./api";
import {
  buildPurchaseCommand,
  defaultDueDate,
  type PurchaseDraft,
  type PurchaseDraftIssue,
  type PurchaseDraftIssues,
  type PurchaseLineDraft,
  previewSubtotal,
  previewTotal,
} from "./draft";
import { ProductPickerDialog, SupplierPickerDialog } from "./pickers";
import { invalidatePurchaseMutation } from "./queries";

export type PurchaseFormProps = {
  /** An assistant draft: the form starts from what it resolved and the user confirms the rest. */
  draft?: AssistantPurchaseDraft;
  entrySource: EntrySource;
  onSaved: (purchaseId: string) => void;
  onCancel: () => void;
  /** Starts the form with this supplier, such as when it opens from the supplier's record. */
  initialSupplier?: { creditDays: number | null; id: string; name: string };
};

type PurchaseVariables = { command: CreatePurchaseRequest; supplierName: string };

function initialDraft(
  business: Business,
  input: Pick<PurchaseFormProps, "draft" | "initialSupplier">,
): PurchaseDraft {
  const now = currentLocalDateTime(business.timeZone);
  const source = input.draft;
  const supplier = source?.supplier.match
    ? { creditDays: null, id: source.supplier.match.id, name: source.supplier.match.name }
    : (input.initialSupplier ?? null);
  const date = source?.occurredLocalDate ?? now.date;
  const lines: PurchaseLineDraft[] = (source?.lines ?? []).flatMap((line) => {
    if (!line.product || line.quantityPrecision === null) return [];
    const precision = line.quantityPrecision;
    return [
      {
        key: Crypto.randomUUID(),
        productId: line.product.id,
        productName: line.product.name,
        quantityPrecision: precision,
        quantity: line.quantityMinorUnits
          ? toDecimalString(line.quantityMinorUnits, precision)
          : "",
        unitCost:
          line.unitAmountMinorUnits !== null
            ? toDecimalString(line.unitAmountMinorUnits, business.currencyMinorUnitDigits)
            : "",
      },
    ];
  });
  return {
    account: source?.account ?? null,
    date,
    dueDate: source?.dueDate ?? defaultDueDate(date, supplier?.creditDays ?? null),
    invoiceNumber: source?.invoiceNumber ?? "",
    lines,
    paymentTerms: source?.paymentTerms ?? "credit",
    received: source?.received ?? true,
    supplier,
    time: source?.occurredLocalTime ?? now.time,
  };
}

/**
 * Records one purchase: supplier, invoice, costed product lines, whether the merchandise arrived
 * and how it is paid. The total shown is a preview of the server's exact rule; the saved purchase
 * carries the server's figures.
 */
export function PurchaseForm(props: PurchaseFormProps) {
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  if (!access.business) return null;
  return <PurchaseFormBody {...props} business={access.business} canManage={access.canManage} />;
}

function PurchaseFormBody({
  business,
  canManage,
  draft: assistantDraft,
  entrySource,
  initialSupplier,
  onCancel,
  onSaved,
}: PurchaseFormProps & { business: Business; canManage: boolean }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const digits = business.currencyMinorUnitDigits;
  const [draft, setDraft] = useState<PurchaseDraft>(() =>
    initialDraft(business, { draft: assistantDraft, initialSupplier }),
  );
  // A due date the user typed is kept when the supplier or the purchase date changes.
  const [dueDateEdited, setDueDateEdited] = useState(Boolean(assistantDraft?.dueDate));
  const [issues, setIssues] = useState<PurchaseDraftIssues>({});
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const supplierRef = useRef<View>(null);
  const accountRef = useRef<View>(null);
  const [sent, setSent] = useState<PurchaseVariables | null>(null);
  const { send, state } = useCommand({
    keyOf: (variables: PurchaseVariables) => variables.command.idempotencyKey,
    mutationFn: ({ command }: PurchaseVariables) => purchasesApi.purchases.create(command),
    onConfirmed: async ({ purchase }, { supplierName }) => {
      await invalidatePurchaseMutation(queryClient, business.id);
      notify.success(t("purchases.form.saved"), {
        description: t("purchases.form.savedDescription", {
          amount: format.money(
            purchase.totalMinorUnits,
            purchase.currency,
            purchase.currencyMinorUnitDigits,
          ),
          supplier: supplierName,
        }),
      });
      onSaved(purchase.id);
    },
  });
  const locked = state.phase === "pending" || state.phase === "uncertain";
  const money = (minorUnits: string) => format.money(minorUnits, business.currency, digits);
  const total = previewTotal(draft.lines, digits);

  const update = (patch: Partial<PurchaseDraft>, cleared: (keyof PurchaseDraftIssues)[] = []) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (cleared.length > 0) {
      setIssues((current) => {
        const next = { ...current };
        for (const key of cleared) delete next[key];
        return next;
      });
    }
  };
  const updateLine = (key: string, patch: Partial<PurchaseLineDraft>) => {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
    setIssues((current) => {
      const lineQuantities = { ...current.lineQuantities };
      const lineCosts = { ...current.lineCosts };
      if ("quantity" in patch) delete lineQuantities[key];
      if ("unitCost" in patch) delete lineCosts[key];
      return { ...current, lineCosts, lineQuantities, lines: undefined };
    });
  };
  const issueText = (issue: PurchaseDraftIssue | undefined, precision = 0) => {
    if (!issue) return undefined;
    switch (issue) {
      case "supplier":
        return t("purchases.form.validation.supplier");
      case "date":
        return t("purchases.form.validation.date");
      case "time":
        return t("purchases.form.validation.time");
      case "invoice":
        return t("purchases.form.validation.invoice");
      case "lines":
        return t("purchases.form.validation.lines");
      case "total":
        return t("purchases.form.validation.total");
      case "quantity":
        return t("purchases.form.validation.quantity", { count: precision });
      case "unit-cost":
        return t("purchases.form.validation.unitCost");
      case "account":
        return t("purchases.form.validation.account");
      case "due-before-date":
        return t("purchases.form.validation.dueBeforeDate");
      default:
        return t("purchases.form.validation.date");
    }
  };
  const submit = () => {
    if (state.phase === "uncertain" && sent) {
      send(sent);
      return;
    }
    const result = buildPurchaseCommand(draft, {
      currencyMinorUnitDigits: digits,
      entrySource,
      idempotencyKey: Crypto.randomUUID(),
    });
    setIssues(result.issues);
    if (!("command" in result) || !draft.supplier) return;
    const variables = { command: result.command, supplierName: draft.supplier.name };
    setSent(variables);
    send(variables);
  };
  const setTerms = (paymentTerms: PurchasePaymentTerms) =>
    update({ paymentTerms }, ["account", "dueDate"]);

  return (
    <View className="gap-4 lg:flex-row lg:items-start">
      <View className="min-w-0 flex-1 gap-5 rounded-lg border border-border bg-card p-4">
        <View className="gap-3">
          <PickerField
            detail={
              draft.supplier && draft.supplier.creditDays !== null
                ? t("purchases.form.creditDaysDetail", { count: draft.supplier.creditDays })
                : undefined
            }
            error={issueText(issues.supplier)}
            label={t("purchases.form.supplier")}
            onPress={() => !locked && setSupplierPickerOpen(true)}
            placeholder={t("purchases.form.chooseSupplier")}
            ref={supplierRef}
            value={draft.supplier?.name}
          />
          <View className="gap-3 sm:flex-row">
            <View className="min-w-0 flex-1">
              <DateField
                disabled={locked}
                error={issueText(issues.date)}
                label={t("purchases.form.date")}
                onChange={(date) => {
                  update(
                    dueDateEdited
                      ? { date }
                      : { date, dueDate: defaultDueDate(date, draft.supplier?.creditDays ?? null) },
                    ["date", "dueDate"],
                  );
                }}
                value={draft.date}
              />
            </View>
            <View className="min-w-0 sm:w-28">
              <TimeField
                disabled={locked}
                error={issueText(issues.time)}
                label={t("purchases.form.time")}
                onChange={(time) => update({ time }, ["time"])}
                value={draft.time}
              />
            </View>
            <View className="min-w-0 flex-1">
              <Field
                description={t("purchases.form.invoiceHint")}
                editable={!locked}
                error={issueText(issues.invoiceNumber)}
                label={t("purchases.form.invoice")}
                maxLength={40}
                onChangeText={(invoiceNumber) => update({ invoiceNumber }, ["invoiceNumber"])}
                placeholder="F-004512"
                value={draft.invoiceNumber}
              />
            </View>
          </View>
        </View>

        <Section
          actions={
            <Button
              disabled={locked || draft.lines.length >= 50}
              onPress={() => setProductPickerOpen(true)}
              size="sm"
              variant="outline"
            >
              <Icon as={Plus} className="text-foreground" size={14} />
              <Text>{t("purchases.form.addProduct")}</Text>
            </Button>
          }
          description={
            draft.lines.length > 0
              ? t("purchases.form.productCount", { count: draft.lines.length })
              : undefined
          }
          title={t("purchases.form.products")}
        >
          {draft.lines.length === 0 ? (
            <View
              className={cn(
                "items-center gap-2 rounded-md border border-dashed px-4 py-6",
                issues.lines ? "border-destructive" : "border-border",
              )}
            >
              <Icon as={PackagePlus} className="text-muted-foreground" size={20} />
              <Text className="text-center text-sm text-muted-foreground">
                {t("purchases.form.noProducts")}
              </Text>
            </View>
          ) : (
            <View className="overflow-hidden rounded-md border border-border">
              {draft.lines.map((line, index) => {
                const subtotal = previewSubtotal(line, digits);
                return (
                  <View
                    className={cn(
                      "gap-2 px-3 py-2.5 md:flex-row md:items-start md:gap-3",
                      index > 0 && "border-t border-border",
                    )}
                    key={line.key}
                  >
                    <View className="min-w-0 flex-row items-start justify-between gap-2 md:flex-1 md:pt-7">
                      <Text className="min-w-0 flex-1 text-sm text-foreground" numberOfLines={2}>
                        {line.productName}
                      </Text>
                      <Button
                        accessibilityLabel={t("purchases.form.removeLine", {
                          product: line.productName,
                        })}
                        className="md:hidden"
                        disabled={locked}
                        onPress={() =>
                          update({ lines: draft.lines.filter(({ key }) => key !== line.key) })
                        }
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Icon as={Trash2} className="text-muted-foreground" size={14} />
                      </Button>
                    </View>
                    <View className="flex-row items-start gap-2">
                      <View className="w-24">
                        <Field
                          editable={!locked}
                          error={issueText(
                            issues.lineQuantities?.[line.key],
                            line.quantityPrecision,
                          )}
                          keyboardType={line.quantityPrecision > 0 ? "decimal-pad" : "number-pad"}
                          label={t("purchases.form.quantity")}
                          onChangeText={(quantity) => updateLine(line.key, { quantity })}
                          value={line.quantity}
                        />
                      </View>
                      <View className="w-28">
                        <Field
                          editable={!locked}
                          error={issueText(issues.lineCosts?.[line.key])}
                          keyboardType="decimal-pad"
                          label={t("purchases.form.unitCost")}
                          onChangeText={(unitCost) => updateLine(line.key, { unitCost })}
                          placeholder={toDecimalString("0", digits)}
                          value={line.unitCost}
                        />
                      </View>
                      <View className="min-w-0 flex-1 items-end gap-2 md:w-28 md:flex-none">
                        <Text className="font-ui text-sm leading-none text-foreground">
                          {t("purchases.form.subtotal")}
                        </Text>
                        <Text className="min-h-9 py-2 text-sm tabular-nums text-foreground">
                          {subtotal === null
                            ? t("purchases.form.pendingSubtotal")
                            : money(subtotal)}
                        </Text>
                      </View>
                      <Button
                        accessibilityLabel={t("purchases.form.removeLine", {
                          product: line.productName,
                        })}
                        className="mt-6 hidden md:flex"
                        disabled={locked}
                        onPress={() =>
                          update({ lines: draft.lines.filter(({ key }) => key !== line.key) })
                        }
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Icon as={Trash2} className="text-muted-foreground" size={14} />
                      </Button>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {issues.lines ? (
            <Text accessibilityRole="alert" className="text-sm text-destructive">
              {issueText(issues.lines)}
            </Text>
          ) : null}
        </Section>

        <View className="flex-row items-start gap-3 rounded-md bg-muted px-3 py-3">
          <Checkbox
            accessibilityLabel={t("purchases.form.received")}
            aria-labelledby="purchase-received-label"
            checked={draft.received}
            className="mt-0.5"
            disabled={locked}
            nativeID="purchase-received"
            onCheckedChange={(received) => !locked && update({ received })}
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Label
              disabled={locked}
              nativeID="purchase-received-label"
              onPress={() => !locked && update({ received: !draft.received })}
            >
              {t("purchases.form.received")}
            </Label>
            <Text className="text-xs text-muted-foreground">
              {draft.received
                ? t("purchases.form.receivedHint")
                : t("purchases.form.notReceivedHint")}
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-4 rounded-lg bg-highlight p-4 lg:w-[300px]">
        <View className="gap-1">
          <Text className="text-xs text-highlight-foreground">{t("purchases.form.total")}</Text>
          <Text
            accessibilityLiveRegion="polite"
            className="font-heading text-3xl tabular-nums text-highlight-foreground"
          >
            {total === null ? money("0") : money(total)}
          </Text>
          {total === null && draft.lines.length > 0 ? (
            <Text className="text-xs text-highlight-foreground">
              {t("purchases.form.totalPending")}
            </Text>
          ) : null}
        </View>
        <FilterBar
          disabled={locked}
          label={t("purchases.form.paymentTerms")}
          onChange={setTerms}
          options={[
            { label: t("purchases.terms.cash"), value: "cash" },
            { label: t("purchases.terms.credit"), value: "credit" },
          ]}
          showLabel
          value={draft.paymentTerms}
        />
        {draft.paymentTerms === "cash" ? (
          <PickerField
            error={issueText(issues.account)}
            label={t("purchases.form.account")}
            onPress={() => !locked && setAccountPickerOpen(true)}
            placeholder={t("purchases.form.chooseAccount")}
            ref={accountRef}
            value={draft.account?.name}
          />
        ) : (
          <DateField
            description={
              draft.supplier?.creditDays !== null && draft.supplier?.creditDays !== undefined
                ? t("purchases.form.dueDateHint", { count: draft.supplier.creditDays })
                : undefined
            }
            disabled={locked}
            error={issueText(issues.dueDate)}
            label={t("purchases.form.dueDate")}
            onChange={(dueDate) => {
              setDueDateEdited(true);
              update({ dueDate }, ["dueDate"]);
            }}
            value={draft.dueDate}
          />
        )}
        {total !== null && total !== "0" ? (
          <Text className="text-xs text-highlight-foreground">
            {draft.paymentTerms === "credit"
              ? t("purchases.form.creditNote", { amount: money(total) })
              : draft.account
                ? t("purchases.form.cashNote", { account: draft.account.name })
                : null}
          </Text>
        ) : null}
        {!canManage ? (
          <Alert icon={CircleAlert} variant="warning">
            <AlertDescription>{t("purchases.form.stale")}</AlertDescription>
          </Alert>
        ) : null}
        {state.phase === "uncertain" ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
            <AlertDescription>{t("purchases.form.uncertain")}</AlertDescription>
          </Alert>
        ) : state.phase === "failed" ? (
          <Alert icon={CircleAlert} variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <View className="gap-2">
          <Button
            disabled={!canManage || state.phase === "pending"}
            label={
              state.phase === "uncertain" ? t("purchases.form.retry") : t("purchases.form.save")
            }
            loading={state.phase === "pending"}
            onPress={submit}
          />
          <Button disabled={locked} label={t("common.cancel")} onPress={onCancel} variant="ghost" />
        </View>
      </View>

      <SupplierPickerDialog
        businessId={business.id}
        onOpenChange={setSupplierPickerOpen}
        onSelect={(supplier) =>
          update(
            dueDateEdited
              ? { supplier }
              : { supplier, dueDate: defaultDueDate(draft.date, supplier.creditDays) },
            ["supplier", "dueDate"],
          )
        }
        open={supplierPickerOpen}
        returnFocusRef={supplierRef}
        selectedId={draft.supplier?.id ?? null}
      />
      <ProductPickerDialog
        businessId={business.id}
        onOpenChange={setProductPickerOpen}
        onSelect={(product) =>
          update(
            {
              lines: [
                ...draft.lines,
                {
                  key: Crypto.randomUUID(),
                  productId: product.id,
                  productName: product.name,
                  quantity: "",
                  quantityPrecision: product.quantityPrecision,
                  unitCost: "",
                },
              ],
            },
            ["lines"],
          )
        }
        open={productPickerOpen}
        selectedId={null}
      />
      <CashAccountPickerDialog
        businessId={business.id}
        onOpenChange={setAccountPickerOpen}
        onSelect={(account) =>
          update({ account: { id: account.id, name: account.name } }, ["account"])
        }
        open={accountPickerOpen}
        returnFocusRef={accountRef}
        selectedId={draft.account?.id ?? null}
      />
    </View>
  );
}
