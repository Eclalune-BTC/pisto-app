import type {
  AssistantSaleDraft,
  Business,
  CreateItemizedSaleRequest,
  EntrySource,
  Product,
  ProductStock,
  SalePaymentMethod,
} from "@pisto/contracts";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { CircleAlert, Info, Lock, TriangleAlert } from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { OfflineState } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { FieldLabel } from "@/components/ui/field-label";
import { FilterBar } from "@/components/ui/filter-bar";
import { Heading } from "@/components/ui/heading";
import { MomentFields } from "@/components/ui/moment-fields";
import { SelectField } from "@/components/ui/select-field";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { useFieldMarker } from "@/features/assistant/draft-slots";
import { productQueryOptions } from "@/features/catalog/queries";
import { CustomerPickerDialog } from "@/features/customers/customer-picker";
import { PickerField } from "@/features/customers/picker-field";
import { requireSupportedLocale } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { ApiClientError } from "@/lib/api-error";
import { cn } from "@/lib/cn";
import { useKeyedCommand } from "@/lib/keyed-command";
import { currentLocalDateTime, formatMinorUnits, toDecimalString } from "@/lib/money";
import { isLockedPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { readFailureKind } from "@/lib/query-state";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { invalidateBusinessReads, saleFormOptionsQueryOptions } from "../queries";
import { readState } from "../state";
import { saleIssueMessages } from "./issue-copy";
import {
  addProductLine,
  defaultAccountFor,
  draftFromAssistant,
  draftTotals,
  type ItemizedSaleDraft,
  type PaymentAccount,
  validateItemizedDraft,
} from "./itemized-draft";
import { ProductSearch } from "./product-search";
import { SaleLinesEditor } from "./sale-lines-editor";

export type ItemizedSaleFormProps = {
  /** A reviewed assistant draft: every field it resolved starts filled, the rest stay empty. */
  draft?: AssistantSaleDraft;
  entrySource: EntrySource;
  onSaved: (saleId: string) => void;
  onCancel: () => void;
};

/** Wide enough for the form beside its payment summary instead of above it. */
const SIDE_BY_SIDE_MIN_WIDTH = 860;
const paymentMethods: readonly SalePaymentMethod[] = ["cash", "transfer", "card"];

/**
 * A counter sale with products, payment and credit (figure 15). It reads the active business
 * itself, so it works on the new-sale route and inside the assistant's review.
 */
export function ItemizedSaleForm({ draft, entrySource, onCancel, onSaved }: ItemizedSaleFormProps) {
  const { t } = useTranslation();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canCreate = business?.access.permissions.includes("sales:create") ?? false;
  const options = useQuery(saleFormOptionsQueryOptions(canCreate ? business?.id : undefined));
  const draftProductIds = [
    ...new Set(draft?.lines.flatMap((line) => (line.product ? [line.product.id] : [])) ?? []),
  ];
  const products = useQueries({
    queries: draftProductIds.map((productId) => productQueryOptions(business?.id, productId)),
  });
  // A matched product removed from the catalog since the draft is reported as not identified.
  const productReads = products.filter(
    (query) => !(query.isError && readFailureKind(query.error) === "notFound"),
  );
  const read = readState([businesses, options, ...productReads]);

  if (read === "denied" || (business && !canCreate)) {
    return (
      <StatePanel
        description={t("sales.new.deniedDescription")}
        icon={Lock}
        level={2}
        title={t("sales.new.deniedTitle")}
      />
    );
  }
  if (read === "offline") return <OfflineState level={2} />;
  if (read === "error") {
    return (
      <StatePanel
        action={
          <Button
            label={t("common.retry")}
            onPress={() => {
              void businesses.refetch();
              void options.refetch();
              for (const query of products) void query.refetch();
            }}
            size="sm"
            variant="outline"
          />
        }
        description={t("sales.itemized.accountsUnavailable")}
        icon={TriangleAlert}
        level={2}
        title={t("sales.unavailableTitle")}
        tone="destructive"
      />
    );
  }
  if (read === "loading" || !business || !options.data) {
    return <ContentSkeleton label={t("sales.itemized.loading")} variant="form" />;
  }

  const accounts = options.data.accounts;
  const catalog = new Map<string, { product: Product; stock: ProductStock | null }>();
  for (const query of products) {
    if (query.data?.product.status === "active") catalog.set(query.data.product.id, query.data);
  }
  const prefill = draft
    ? draftFromAssistant({
        accounts,
        assistant: draft,
        currencyDigits: business.currencyMinorUnitDigits,
        products: catalog,
      })
    : null;
  const now = currentLocalDateTime(business.timeZone);
  const initial: ItemizedSaleDraft = prefill?.draft ?? {
    customer: null,
    date: now.date,
    time: now.time,
    lines: [],
    note: "",
    received: "",
    receivedEdited: false,
    method: "cash",
    accountId: defaultAccountFor("cash", accounts),
    dueDate: "",
  };
  return (
    <ItemizedSaleEditor
      accounts={accounts}
      business={business}
      entrySource={entrySource}
      initial={initial}
      key={business.id}
      onCancel={onCancel}
      onSaved={onSaved}
      unmatched={prefill?.unmatched ?? []}
    />
  );
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000,
  );
}

function ItemizedSaleEditor({
  accounts,
  business,
  entrySource,
  initial,
  onCancel,
  onSaved,
  unmatched,
}: {
  accounts: readonly PaymentAccount[];
  business: Business;
  entrySource: EntrySource;
  initial: ItemizedSaleDraft;
  onCancel: () => void;
  onSaved: (saleId: string) => void;
  unmatched: readonly string[];
}) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const client = useQueryClient();
  const customerMarker = useFieldMarker("customer");
  const productMarker = useFieldMarker("product");
  const receivedMarker = useFieldMarker("received");
  const accountMarker = useFieldMarker("account");
  const creditMarker = useFieldMarker("credit");
  const dueDateMarker = useFieldMarker("dueDate");
  const { onLayout, width } = useMeasuredWidth();
  const wide = width >= SIDE_BY_SIDE_MIN_WIDTH;
  const [draft, setDraft] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const customerRef = useRef<View>(null);
  const digits = business.currencyMinorUnitDigits;
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, business.currency, digits, locale);

  const save = useKeyedCommand({
    mutationFn: (command: CreateItemizedSaleRequest) => api.sales.createItemized(command),
    onConfirmed: async (result) => {
      await invalidateBusinessReads(client, business.id);
      const saleId = result.sale.id;
      notify.success(t("sales.itemized.saved"), {
        action: {
          label: t("sales.viewSale"),
          onPress: () =>
            router.navigate({ pathname: "/operate/sales/[saleId]", params: { saleId } }),
        },
        description:
          result.settlement.creditMinorUnits === "0"
            ? money(result.sale.grossMinorUnits)
            : t("sales.itemized.savedOnCredit", {
                amount: money(result.settlement.creditMinorUnits),
              }),
      });
      onSaved(saleId);
    },
  });
  const locked = isLockedPhase(save.phase) || save.isSuccess;
  const update = (change: Partial<ItemizedSaleDraft>) => {
    if (!locked) setDraft((current) => ({ ...current, ...change }));
  };

  const validation = validateItemizedDraft(draft, digits);
  const issues = attempted ? validation.issues : null;
  const errors = issues ? saleIssueMessages(t, issues.sale) : {};
  const totals = draftTotals(draft, digits);
  const total = totals.totalMinorUnits ?? "0";
  const balance = totals.balanceMinorUnits ?? "0";
  const owes = balance !== "0";
  const receives = totals.receivedMinorUnits !== "0";
  const selectedIds = new Set(draft.lines.map((line) => line.product.id));

  const submit = () => {
    if (save.isPending || save.isSuccess) return;
    if (save.phase === "uncertain" && save.variables) {
      save.send(save.variables);
      return;
    }
    setAttempted(true);
    if (!validation.command) return;
    save.send(
      withStableIdempotencyKey(save.variables, {
        idempotencyKey: Crypto.randomUUID(),
        entrySource,
        ...validation.command,
      }),
    );
  };

  const failure =
    save.phase === "uncertain"
      ? { tone: "warning" as const, text: t("sales.itemized.uncertain") }
      : save.phase === "failed"
        ? {
            tone: "destructive" as const,
            text:
              save.error instanceof ApiClientError && save.error.code === "CONFLICT"
                ? t("sales.itemized.conflict")
                : productErrorMessage(save.error, t("sales.itemized.failed"), t, "sale"),
          }
        : null;
  const saveLabel =
    save.phase === "uncertain" ? t("common.retrySameConfirmation") : t("sales.itemized.save");
  const productCount = t("sales.itemized.productCount", { count: draft.lines.length });

  const customerAndDate = (
    <View className={cn("min-w-0 gap-3", wide && "flex-row items-start")}>
      <View className={cn("min-w-0 gap-1.5", wide && "flex-1")}>
        <PickerField
          error={errors.customer}
          label={t("sales.itemized.customer")}
          marker={customerMarker}
          onPress={() => {
            if (!locked) setPickerOpen(true);
          }}
          placeholder={t("sales.itemized.counterSale")}
          ref={customerRef}
          value={draft.customer?.name}
        />
        {draft.customer && !locked ? (
          <Button
            className="min-h-0 self-start px-0 py-0"
            label={t("sales.itemized.clearCustomer")}
            onPress={() => update({ customer: null })}
            size="sm"
            variant="link"
          />
        ) : errors.customer ? null : (
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("sales.itemized.customerHint")}
          </Text>
        )}
      </View>
      <View className={cn("min-w-0", wide && "w-[340px]")}>
        <MomentFields
          date={draft.date}
          dateError={errors.date}
          disabled={locked}
          onDateChange={(date) => update({ date })}
          onTimeChange={(time) => update({ time })}
          time={draft.time}
          timeError={errors.time}
        />
      </View>
    </View>
  );

  const productsBlock = (
    <View className="min-w-0 gap-3">
      <View className="flex-row items-baseline justify-between gap-3">
        <FieldLabel marker={productMarker}>
          <Heading level={2} size="section">
            {t("sales.itemized.productsTitle")}
          </Heading>
        </FieldLabel>
        {draft.lines.length > 0 ? (
          <Text className="text-xs text-muted-foreground tabular-nums">{productCount}</Text>
        ) : null}
      </View>
      <ProductSearch
        businessId={business.id}
        disabled={locked}
        onAdd={({ product, stock }) =>
          update({ lines: addProductLine(draft.lines, product, stock) })
        }
        selectedIds={selectedIds}
      />
      <SaleLinesEditor
        currency={business.currency}
        currencyDigits={digits}
        disabled={locked}
        issues={issues?.lines ?? null}
        lines={draft.lines}
        onChange={(productId, change) =>
          update({
            lines: draft.lines.map((line) =>
              line.product.id === productId ? { ...line, ...change } : line,
            ),
          })
        }
        onRemove={(productId) =>
          update({ lines: draft.lines.filter((line) => line.product.id !== productId) })
        }
        wide={wide}
      />
      {errors.lines ? (
        <Text accessibilityRole="alert" className="text-[13px] leading-5 text-destructive">
          {errors.lines}
        </Text>
      ) : null}
    </View>
  );

  const note = (
    <Field
      editable={!locked}
      error={errors.note}
      label={t("sales.itemized.note")}
      maxLength={240}
      onChangeText={(value) => update({ note: value })}
      placeholder={t("sales.itemized.notePlaceholder")}
      value={draft.note}
    />
  );

  const dueDays =
    owes && /^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) && !errors.dueDate
      ? daysBetween(draft.date, draft.dueDate)
      : null;
  const payment = (
    <View className="min-w-0 gap-4">
      <Field
        editable={!locked}
        error={errors.received}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label={t("sales.itemized.received")}
        marker={receivedMarker}
        onChangeText={(value) => update({ received: value, receivedEdited: true })}
        selectTextOnFocus
        value={draft.receivedEdited ? draft.received : toDecimalString(total, digits)}
      />
      {receives ? (
        <>
          <FilterBar
            disabled={locked}
            label={t("sales.itemized.method")}
            onChange={(method) =>
              update({ method, accountId: defaultAccountFor(method, accounts) ?? draft.accountId })
            }
            options={paymentMethods.map((value) => ({
              label: t(`sales.itemized.methods.${value}`),
              value,
            }))}
            showLabel
            value={draft.method}
          />
          {accounts.length === 0 ? (
            <Alert icon={Info} role="note">
              <AlertDescription>{t("sales.itemized.noAccounts")}</AlertDescription>
            </Alert>
          ) : (
            <SelectField
              disabled={locked}
              error={errors.account}
              label={t("sales.itemized.account")}
              marker={accountMarker}
              onChange={(accountId) => update({ accountId })}
              options={accounts.map((account) => ({ label: account.name, value: account.id }))}
              placeholder={t("sales.itemized.accountPlaceholder")}
              value={draft.accountId}
            />
          )}
        </>
      ) : null}
      {owes ? (
        <View className="min-w-0 gap-3 rounded-md border border-border bg-background p-3">
          <View className="flex-row items-baseline justify-between gap-3">
            <FieldLabel marker={creditMarker ?? dueDateMarker}>
              <Text className="text-sm font-medium">{t("sales.itemized.balance")}</Text>
            </FieldLabel>
            <Text className="font-ui text-base font-semibold tabular-nums">{money(balance)}</Text>
          </View>
          <Text className="text-xs leading-4 text-muted-foreground">
            {draft.customer
              ? t("sales.itemized.balanceHint", { customer: draft.customer.name })
              : t("sales.itemized.balanceNeedsCustomer")}
          </Text>
          <DateField
            description={
              dueDays === null
                ? undefined
                : dueDays === 0
                  ? t("sales.itemized.dueToday")
                  : dueDays > 0
                    ? t("sales.itemized.dueIn", { count: dueDays })
                    : undefined
            }
            disabled={locked}
            error={errors.dueDate}
            label={t("sales.itemized.dueDate")}
            onChange={(dueDate) => update({ dueDate })}
            value={draft.dueDate}
          />
        </View>
      ) : null}
    </View>
  );

  const saveButton = (
    <Button
      className={wide ? undefined : "flex-1"}
      disabled={save.isSuccess}
      label={saveLabel}
      loading={save.isPending}
      onPress={submit}
    />
  );
  const cancelButton = (
    <Button
      disabled={locked}
      label={t("common.cancel")}
      onPress={onCancel}
      variant={wide ? "ghost" : "outline"}
    />
  );
  // The panel stacks the primary step first; a compact footer ends with it, like every form.
  const actions = wide ? (
    <View className="gap-2">
      {saveButton}
      {cancelButton}
    </View>
  ) : (
    <View className="flex-row gap-2">
      {cancelButton}
      {saveButton}
    </View>
  );

  const notices: ReactNode[] = [];
  if (unmatched.length > 0) {
    notices.push(
      <Alert icon={Info} key="unmatched" role="note">
        <AlertDescription>
          {t("sales.itemized.unmatched", {
            items: unmatched.map((item) => `«${item}»`).join(", "),
          })}
        </AlertDescription>
      </Alert>,
    );
  }
  if (failure) {
    notices.push(
      <Alert
        icon={failure.tone === "warning" ? TriangleAlert : CircleAlert}
        key="failure"
        variant={failure.tone}
      >
        <AlertDescription>{failure.text}</AlertDescription>
      </Alert>,
    );
  }

  const totalBlock = (
    <View className="gap-0.5">
      <Text className="text-[13px] text-highlight-foreground/80">{t("sales.itemized.total")}</Text>
      <Text
        accessibilityLiveRegion="polite"
        className="font-heading text-3xl font-semibold tabular-nums text-highlight-foreground"
      >
        {money(total)}
      </Text>
      {draft.lines.length > 0 ? (
        <Text className="text-xs text-highlight-foreground/80 tabular-nums">{productCount}</Text>
      ) : null}
    </View>
  );

  return (
    <View className="min-w-0 gap-5" onLayout={onLayout}>
      {notices}
      {wide ? (
        <View className="flex-row items-start gap-6">
          <View className="min-w-0 flex-1 gap-6">
            {customerAndDate}
            {productsBlock}
            {note}
          </View>
          <View className="w-[320px] shrink-0 overflow-hidden rounded-lg border border-border bg-card">
            <View className="bg-highlight px-4 py-3">{totalBlock}</View>
            <View className="gap-4 p-4">
              {payment}
              {actions}
            </View>
          </View>
        </View>
      ) : (
        <>
          {customerAndDate}
          {productsBlock}
          <View className="min-w-0 gap-3">
            <Heading level={2} size="section">
              {t("sales.detail.settlementTitle")}
            </Heading>
            {payment}
          </View>
          {note}
          <View
            className="-mx-4 gap-2 border-t border-border bg-background px-4 pb-3 pt-3"
            // The total and the save stay in reach while a long list of products scrolls.
            style={
              Platform.OS === "web" ? ({ position: "sticky", bottom: 0 } as object) : undefined
            }
          >
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="text-sm text-muted-foreground">
                {t("sales.itemized.total")} · {productCount}
              </Text>
              <Text className="font-ui text-lg font-semibold tabular-nums">{money(total)}</Text>
            </View>
            {owes ? (
              <View className="flex-row items-baseline justify-between gap-3">
                <Text className="text-[13px] text-muted-foreground">
                  {t("sales.itemized.balance")}
                </Text>
                <Text className="font-ui text-[13px] tabular-nums">{money(balance)}</Text>
              </View>
            ) : null}
            {actions}
          </View>
        </>
      )}
      <CustomerPickerDialog
        businessId={business.id}
        freshChoiceOnly
        onOpenChange={setPickerOpen}
        onSelect={(customer) => update({ customer: { id: customer.id, name: customer.name } })}
        open={pickerOpen}
        returnFocusRef={customerRef}
        selectedId={draft.customer?.id ?? null}
        status="active"
      />
    </View>
  );
}
