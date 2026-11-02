import type {
  ApplyReceivablePaymentRequest,
  AssistantReceivablePaymentDraft,
  CashAccount,
  Receivable,
} from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import type { TFunction } from "i18next";
import { Lock, TriangleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { CommandReview } from "@/components/command-review";
import { FormActions } from "@/components/layout/form-actions";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FieldError } from "@/components/ui/field-error";
import { FilterBar } from "@/components/ui/filter-bar";
import { type CursorPage, LoadMoreButton } from "@/components/ui/load-more-button";
import { MomentFields } from "@/components/ui/moment-fields";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { manageCapabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { commandPhase } from "@/features/customers/command-state";
import { useRecordFormat } from "@/features/customers/format";
import { customerDetailQueryOptions } from "@/features/customers/queries";
import { readState } from "@/features/customers/read-state";
import { useCommand } from "@/features/customers/use-command";
import { cn } from "@/lib/cn";
import type { EntrySource } from "@/lib/entry-source";
import { currentLocalDateTime, parseAmountToMinorUnits, toDecimalString } from "@/lib/money";
import type { MutationPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { flattenPages } from "@/lib/pages";
import { ChoiceList } from "../cash/choice-list";
import { activeCashAccountsInfiniteOptions } from "../cash/queries";
import { receivablesApi } from "./api";
import { buildPaymentCommand, type PaymentDraft, type ReceivableDraftIssue } from "./draft";
import { invalidateReceivableMutation } from "./mutation-state";
import { amountInputPlaceholder } from "./presentation";
import { receivableDetailQueryOptions, receivablesQueryOptions } from "./queries";
import { accountsForMethod, type PaymentMethod, quickAmounts } from "./receivable-figures";
import { acceptsPayment } from "./rules";

export type ReceivablePaymentFormProps = {
  /** Applies a customer's payment to this receivable. */
  receivableId?: string;
  /** Without a receivable, the user chooses one of this customer's open receivables. */
  customerId?: string;
  /** What the assistant resolved; every value stays editable before review. */
  draft?: AssistantReceivablePaymentDraft;
  /**
   * How the payment was captured. The payment command does not carry it yet; it is sent once the
   * receivable payment contract accepts an entry source.
   */
  entrySource: EntrySource;
  onCancel: () => void;
  /** Lets a host overlay refuse to close while a confirmation is pending or uncertain. */
  onPhaseChange?: (phase: MutationPhase) => void;
  onSaved: (paymentId: string) => void;
};

type PaymentErrors = Partial<Record<keyof PaymentDraft | "cashAccount", string>>;

function issueMessage(t: TFunction, issue: ReceivableDraftIssue | undefined, digits: number) {
  if (!issue) return undefined;
  if (issue === "cash-account") return t("receivables.validation.cashAccount");
  if (issue === "date") return t("receivables.validation.date");
  if (issue === "time") return t("receivables.validation.time");
  if (issue === "reference") return t("receivables.validation.reference");
  if (issue === "overpayment") return t("receivables.validation.overpayment");
  return t("receivables.validation.amount", { count: digits });
}

function SummaryRow({
  emphasis = false,
  label,
  tone,
  value,
}: {
  emphasis?: boolean;
  label: string;
  tone?: "positive";
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 px-3 py-2">
      <Text
        className={cn(
          "text-[13px]",
          emphasis ? "font-heading text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
      <Text
        className={cn(
          "text-[13px] tabular-nums",
          emphasis && "font-heading",
          tone === "positive" && "text-positive",
        )}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Records one customer payment ("abono") against a receivable: the form, its review and the keyed
 * command. A sheet, a route or the assistant review renders it under its own title.
 */
export function ReceivablePaymentForm({
  customerId,
  draft,
  onCancel,
  onPhaseChange,
  onSaved,
  receivableId,
}: ReceivablePaymentFormProps) {
  const { t } = useTranslation();
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.hasManagePermission);
  const [chosenId, setChosenId] = useState<string | null>(
    receivableId ?? draft?.receivable?.id ?? null,
  );
  const ownerId = customerId ?? draft?.customer.match?.id;
  const overdue = useInfiniteQuery({
    ...receivablesQueryOptions(
      businessId,
      ownerId ? { customerId: ownerId, state: "overdue" } : undefined,
    ),
    enabled: enabled && !chosenId && ownerId !== undefined,
  });
  const open = useInfiniteQuery({
    ...receivablesQueryOptions(
      businessId,
      ownerId ? { customerId: ownerId, state: "open" } : undefined,
    ),
    enabled: enabled && !chosenId && ownerId !== undefined,
  });
  const choices = [...flattenPages(overdue.data), ...flattenPages(open.data)];
  const choicesRead = readState([overdue, open]);
  const choicesComplete = choicesRead.kind === "ready" && !overdue.hasNextPage && !open.hasNextPage;
  // A customer with a single open receivable has nothing to choose.
  const onlyChoice = !chosenId && choicesComplete && choices.length === 1 ? choices[0] : undefined;
  const effectiveId = chosenId ?? onlyChoice?.id ?? null;

  if (!chosenId && !ownerId) {
    throw new Error("A receivable payment needs a receivable or a customer");
  }
  const accessState = manageCapabilityBoundaryState(access);
  if (accessState === "loading") return <ContentSkeleton variant="form" />;
  if (accessState !== "ready") {
    return (
      <StatePanel
        description={t("receivables.paymentForm.deniedDescription")}
        icon={Lock}
        level={2}
        title={t("receivables.list.deniedTitle")}
      />
    );
  }
  if (effectiveId) {
    return (
      <PaymentFields
        draft={draft}
        key={effectiveId}
        onCancel={onCancel}
        onChooseAnother={chosenId && !receivableId && ownerId ? () => setChosenId(null) : undefined}
        onPhaseChange={onPhaseChange}
        onSaved={onSaved}
        receivableId={effectiveId}
      />
    );
  }
  return (
    <ReceivableChoice
      choices={choices}
      loading={choicesRead.kind === "loading"}
      failed={choicesRead.kind !== "ready" && choicesRead.kind !== "loading"}
      onCancel={onCancel}
      onChoose={setChosenId}
      onRetry={() => {
        void overdue.refetch();
        void open.refetch();
      }}
      page={{
        hasMore: overdue.hasNextPage || open.hasNextPage,
        loadingMore: overdue.isFetchingNextPage || open.isFetchingNextPage,
        onLoadMore: () => {
          if (overdue.hasNextPage) void overdue.fetchNextPage();
          else void open.fetchNextPage();
        },
      }}
    />
  );
}

function ReceivableChoice({
  choices,
  failed,
  loading,
  onCancel,
  onChoose,
  onRetry,
  page,
}: {
  choices: Receivable[];
  failed: boolean;
  loading: boolean;
  onCancel: () => void;
  onChoose: (receivableId: string) => void;
  onRetry: () => void;
  page: CursorPage;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const [picked, setPicked] = useState<string | null>(null);
  if (loading) return <ContentSkeleton variant="form" />;
  if (failed) {
    return (
      <StatePanel
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        description={t("relationships.common.unavailableDescription")}
        icon={TriangleAlert}
        level={2}
        title={t("receivables.list.errorTitle")}
        tone="destructive"
      />
    );
  }
  if (choices.length === 0) {
    return (
      <View className="gap-4">
        <Text className="text-[13px] leading-5 text-muted-foreground">
          {t("receivables.paymentForm.nothingOwed")}
        </Text>
        <View className="items-end">
          <Button label={t("common.close")} onPress={onCancel} variant="outline" />
        </View>
      </View>
    );
  }
  const selected = choices.find(({ id }) => id === picked)?.id ?? choices[0]?.id;
  if (!selected) throw new Error("A receivable choice needs at least one receivable");
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <ChoiceList
          label={t("receivables.paymentForm.receivable")}
          onChange={setPicked}
          options={choices.map((receivable) => ({
            label: t("receivables.paymentForm.receivableOption", {
              amount: format.money(
                receivable.outstandingMinorUnits,
                receivable.currency,
                receivable.currencyMinorUnitDigits,
              ),
              description: receivable.description,
            }),
            value: receivable.id,
          }))}
          value={selected}
        />
        <LoadMoreButton className="self-start" page={page} />
      </View>
      <FormActions
        onCancel={onCancel}
        onSubmit={() => onChoose(selected)}
        submitLabel={t("receivables.paymentForm.continue")}
      />
    </View>
  );
}

/** The command a confirmation sends, with the account name the success message repeats. */
type PaymentVariables = { accountName: string; command: ApplyReceivablePaymentRequest };

function PaymentFields({
  draft: assistantDraft,
  onCancel,
  onChooseAnother,
  onPhaseChange,
  onSaved,
  receivableId,
}: {
  draft?: AssistantReceivablePaymentDraft;
  onCancel: () => void;
  onChooseAnother?: () => void;
  onPhaseChange?: (phase: MutationPhase) => void;
  onSaved: (paymentId: string) => void;
  receivableId: string;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const queryClient = useQueryClient();
  const access = useCapabilityAccess("receivables:read", "receivables:manage");
  const business = access.business;
  const businessId = business?.id;
  const detail = useQuery({
    ...receivableDetailQueryOptions(businessId, receivableId),
    enabled: Boolean(businessId),
  });
  const customerId = detail.data?.receivable.customerId;
  const customer = useQuery({
    ...customerDetailQueryOptions(businessId, customerId),
    enabled: Boolean(businessId && customerId),
  });
  const accountsQuery = useInfiniteQuery(activeCashAccountsInfiniteOptions(businessId));
  const accounts = flattenPages(accountsQuery.data);
  const [values, setValues] = useState<PaymentDraft>(() => {
    const now = business ? currentLocalDateTime(business.timeZone) : null;
    return {
      amount: "",
      date: assistantDraft?.occurredLocalDate ?? now?.date ?? "",
      reference: "",
      time: assistantDraft?.occurredLocalTime ?? now?.time ?? "",
    };
  });
  const [accountId, setAccountId] = useState<string | null>(assistantDraft?.account?.id ?? null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [errors, setErrors] = useState<PaymentErrors>({});
  const [command, setCommand] = useState<ApplyReceivablePaymentRequest | null>(null);
  const [reviewAccount, setReviewAccount] = useState<CashAccount | null>(null);
  const [amountSeeded, setAmountSeeded] = useState(false);

  const receivable = detail.data?.receivable;
  const digits = receivable?.currencyMinorUnitDigits;
  const draftAmount = assistantDraft?.amountMinorUnits ?? null;
  // The resolved amount is shown once, in the receivable's digits; later edits are the user's.
  useEffect(() => {
    if (amountSeeded || digits === undefined) return;
    setAmountSeeded(true);
    if (draftAmount === null) return;
    setValues((current) => ({ ...current, amount: toDecimalString(draftAmount, digits) }));
  }, [amountSeeded, digits, draftAmount]);

  const { reset, send, state } = useCommand({
    conflictMessage: t("receivables.payment.conflict"),
    keyOf: (variables: PaymentVariables) => variables.command.idempotencyKey,
    mutationFn: ({ command: next }: PaymentVariables) =>
      receivablesApi.applyPayment(receivableId, next),
    onConfirmed: async ({ payment, receivable: confirmed }, { accountName }) => {
      if (businessId) {
        await invalidateReceivableMutation(queryClient, {
          businessId,
          customerId: confirmed.customerId,
        });
      }
      notify.success(t("receivables.payment.done"), {
        description: t("receivables.payment.doneDescription", {
          account: accountName,
          amount: format.money(
            payment.amountMinorUnits,
            payment.currency,
            payment.currencyMinorUnitDigits,
          ),
        }),
      });
      onSaved(payment.id);
    },
  });
  const phase = commandPhase(state);
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  const read = readState(customerId ? [detail, customer, accountsQuery] : [detail]);
  if (read.kind === "loading" || (read.kind === "ready" && (!receivable || !customer.data))) {
    return <ContentSkeleton variant="form" />;
  }
  if (read.kind !== "ready" || !receivable || !customer.data) {
    return (
      <StatePanel
        action={
          <Button
            label={t("common.retry")}
            onPress={() => {
              void detail.refetch();
              void customer.refetch();
              void accountsQuery.refetch();
            }}
            size="sm"
            variant="outline"
          />
        }
        description={t("relationships.common.unavailableDescription")}
        icon={TriangleAlert}
        level={2}
        title={t("receivables.paymentForm.unavailableTitle")}
        tone="destructive"
      />
    );
  }

  const customerName = customer.data.customer.name;
  const money = (minorUnits: string) =>
    format.money(minorUnits, receivable.currency, receivable.currencyMinorUnitDigits);
  const stale = read.stale || access.isStale;
  const accepting =
    acceptsPayment(receivable, customer.data.customer.status === "active") ||
    phase === "pending" ||
    phase === "uncertain";
  const owes = (
    <Text className="text-[13px] leading-5 text-muted-foreground">
      {t("receivables.paymentForm.owes", {
        amount: money(receivable.outstandingMinorUnits),
        charge: receivable.description,
        customer: customerName,
      })}
    </Text>
  );

  if (!accepting) {
    return (
      <View className="gap-4">
        {owes}
        <Text className="text-[13px] leading-5">{t("receivables.paymentForm.closed")}</Text>
        <View className="items-end">
          <Button label={t("common.close")} onPress={onCancel} variant="outline" />
        </View>
      </View>
    );
  }

  if (command && reviewAccount) {
    return (
      <View className="gap-4">
        {owes}
        <CommandReview
          confirmLabel={t("receivables.paymentForm.confirm")}
          disabled={stale}
          errorMessage={state.phase === "failed" ? state.message : undefined}
          items={[
            {
              label: t("receivables.paymentForm.amount"),
              numeric: true,
              value: money(command.amountMinorUnits),
            },
            { label: t("receivables.paymentForm.account"), value: reviewAccount.name },
            {
              label: t("receivables.payment.occurred"),
              numeric: true,
              value: t("receivables.payments.occurredAt", {
                date: format.date(command.occurredLocalDate),
                time: command.occurredLocalTime,
              }),
            },
            ...(command.reference
              ? [{ label: t("receivables.paymentForm.note"), value: command.reference }]
              : []),
            {
              label: t("receivables.paymentForm.balanceAfter"),
              numeric: true,
              value: money(
                (
                  BigInt(receivable.outstandingMinorUnits) - BigInt(command.amountMinorUnits)
                ).toString(),
              ),
            },
          ]}
          note={t("receivables.payment.reviewDescription")}
          onConfirm={() => send({ accountName: reviewAccount.name, command })}
          onEdit={() => {
            setCommand(null);
            setReviewAccount(null);
            reset();
          }}
          phase={phase}
          title={t("receivables.paymentForm.reviewTitle")}
          uncertainDescription={state.phase === "uncertain" ? state.message : undefined}
        />
      </View>
    );
  }

  const chosenAccount = accounts.find((account) => account.id === accountId);
  const activeMethod: PaymentMethod =
    method ??
    (chosenAccount
      ? chosenAccount.kind === "cash"
        ? "cash"
        : "transfer"
      : accountsForMethod(accounts, "cash").length > 0
        ? "cash"
        : "transfer");
  const offered = accountsForMethod(accounts, activeMethod);
  // Like the expense form, the first account of the method is preselected; the review names it.
  const selectedAccount = offered.find((account) => account.id === accountId) ?? offered[0];
  const parsed = parseAmountToMinorUnits(values.amount, receivable.currencyMinorUnitDigits);
  const amount =
    "value" in parsed && BigInt(parsed.value) <= BigInt(receivable.outstandingMinorUnits)
      ? parsed.value
      : null;
  const setAmount = (minorUnits: string) => {
    setValues((current) => ({
      ...current,
      amount: toDecimalString(minorUnits, receivable.currencyMinorUnitDigits),
    }));
    setErrors((current) => ({ ...current, amount: undefined }));
  };

  const prepareReview = () => {
    if (stale) return;
    const result = buildPaymentCommand(
      values,
      selectedAccount ?? null,
      receivable.currencyMinorUnitDigits,
      receivable.outstandingMinorUnits,
      Crypto.randomUUID(),
    );
    const fractionDigits = receivable.currencyMinorUnitDigits;
    setErrors({
      amount: issueMessage(t, result.issues.amount, fractionDigits),
      cashAccount: issueMessage(t, result.issues.cashAccount, fractionDigits),
      date: issueMessage(t, result.issues.date, fractionDigits),
      reference: issueMessage(t, result.issues.reference, fractionDigits),
      time: issueMessage(t, result.issues.time, fractionDigits),
    });
    if (!("command" in result) || !selectedAccount) return;
    reset();
    setReviewAccount(selectedAccount);
    setCommand(result.command);
  };

  return (
    <View className="gap-4">
      <View className="gap-1">
        {owes}
        {onChooseAnother ? (
          <Button
            className="self-start px-0"
            label={t("receivables.paymentForm.chooseAnother")}
            onPress={onChooseAnother}
            size="sm"
            variant="link"
          />
        ) : null}
      </View>
      {stale ? (
        <StaleNotice
          onRetry={() => {
            void access.refetch();
            void detail.refetch();
            void customer.refetch();
          }}
        />
      ) : null}
      <View className="gap-2">
        <Field
          error={errors.amount}
          keyboardType="decimal-pad"
          label={t("receivables.paymentForm.amount")}
          onChangeText={(amountText) => {
            setValues((current) => ({ ...current, amount: amountText }));
            setErrors((current) => ({ ...current, amount: undefined }));
          }}
          placeholder={amountInputPlaceholder(receivable.currencyMinorUnitDigits)}
          trailing={<Text className="text-xs text-muted-foreground">{receivable.currency}</Text>}
          value={values.amount}
        />
        <View className="flex-row flex-wrap gap-1.5">
          <Button
            label={t("receivables.paymentForm.all", {
              amount: money(receivable.outstandingMinorUnits),
            })}
            onPress={() => setAmount(receivable.outstandingMinorUnits)}
            size="sm"
            variant="outline"
          />
          {quickAmounts(receivable.outstandingMinorUnits, receivable.currencyMinorUnitDigits).map(
            (quick) => (
              <Button
                key={quick}
                label={money(quick)}
                onPress={() => setAmount(quick)}
                size="sm"
                variant="outline"
              />
            ),
          )}
        </View>
      </View>
      <FilterBar<PaymentMethod>
        label={t("receivables.paymentForm.method")}
        onChange={(next) => {
          setMethod(next);
          if (chosenAccount && !accountsForMethod(accounts, next).includes(chosenAccount)) {
            setAccountId(null);
          }
        }}
        options={[
          { label: t("receivables.paymentForm.methods.cash"), value: "cash" },
          { label: t("receivables.paymentForm.methods.transfer"), value: "transfer" },
        ]}
        showLabel
        value={activeMethod}
      />
      <View className="gap-1.5">
        {selectedAccount ? (
          <FilterBar
            label={t("receivables.paymentForm.account")}
            onChange={(next) => {
              setAccountId(next);
              setErrors((current) => ({ ...current, cashAccount: undefined }));
            }}
            options={offered.map(({ id, name }) => ({ label: name, value: id }))}
            showLabel
            value={selectedAccount.id}
          />
        ) : (
          <View className="gap-1.5">
            <Text className="font-ui text-xs text-muted-foreground">
              {t("receivables.paymentForm.account")}
            </Text>
            <Text className="text-[13px] leading-5 text-muted-foreground">
              {t(`receivables.paymentForm.noAccounts.${activeMethod}`)}
            </Text>
          </View>
        )}
        <FieldError message={errors.cashAccount} />
        <LoadMoreButton
          className="self-start"
          label={t("cash.fields.loadMoreAccounts")}
          page={{
            hasMore: accountsQuery.hasNextPage,
            loadingMore: accountsQuery.isFetchingNextPage,
            onLoadMore: () => void accountsQuery.fetchNextPage(),
          }}
        />
      </View>
      <MomentFields
        date={values.date}
        dateError={errors.date}
        onDateChange={(date) => setValues((current) => ({ ...current, date }))}
        onTimeChange={(time) => setValues((current) => ({ ...current, time }))}
        time={values.time}
        timeError={errors.time}
      />
      <Field
        error={errors.reference}
        label={t("receivables.paymentForm.noteOptional")}
        maxLength={120}
        onChangeText={(reference) => setValues((current) => ({ ...current, reference }))}
        placeholder={t("receivables.paymentForm.notePlaceholder")}
        value={values.reference}
      />
      <View
        accessibilityLabel={t("receivables.paymentForm.summary")}
        className="overflow-hidden rounded-lg bg-muted"
        role="region"
      >
        <SummaryRow
          label={t("receivables.paymentForm.currentBalance")}
          value={money(receivable.outstandingMinorUnits)}
        />
        <SummaryRow
          label={t("receivables.paymentForm.payment")}
          tone={amount ? "positive" : undefined}
          value={amount ? money(`-${amount}`) : "—"}
        />
        <View className="border-t border-border">
          <SummaryRow
            emphasis
            label={t("receivables.paymentForm.balanceAfter")}
            value={
              amount
                ? money((BigInt(receivable.outstandingMinorUnits) - BigInt(amount)).toString())
                : "—"
            }
          />
        </View>
      </View>
      <FormActions
        disabled={stale}
        onCancel={onCancel}
        onSubmit={prepareReview}
        submitLabel={t("receivables.paymentForm.review")}
      />
    </View>
  );
}
