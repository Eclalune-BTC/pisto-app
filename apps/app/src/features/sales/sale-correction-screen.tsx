import type { ReplaceSaleRequest, Sale, SaleDetails, VoidSaleRequest } from "@pisto/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { CircleAlert, Info, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { useKeyedCommand } from "@/lib/keyed-command";
import { formatMinorUnits, toDecimalString } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData, readFailureKind } from "@/lib/query-state";
import { ActionBar } from "./action-bar";
import { type CorrectionMode, CorrectionModeField } from "./correction-mode-field";
import { invalidateBusinessReads, saleFormOptionsQueryOptions, saleQueryOptions } from "./queries";
import {
  emptySaleDraft,
  type SaleDraftErrors,
  type SaleDraftValues,
  saleDraftErrors,
  validateSaleDraft,
} from "./sale-draft";
import { firstInvalidField, type SaleDraftFieldRefs, SaleDraftFields } from "./sale-draft-fields";
import { saleAmount, saleDescriptionItem, saleFactItems, saleMoment } from "./sale-facts";
import { canCorrectSale, readState } from "./state";

/** What voiding an itemized sale undoes, stated before the person confirms it. */
function VoidEffects({
  accountName,
  details,
  locale,
  sale,
  t,
}: {
  accountName: string | null;
  details: SaleDetails;
  locale: string;
  sale: Sale;
  t: TFunction;
}) {
  const money = (value: string) =>
    formatMinorUnits(value, sale.currency, sale.currencyMinorUnitDigits, locale);
  const { settlement } = details;
  const effects: string[] = [t("sales.correction.effectStock")];
  if (settlement.receivedMinorUnits !== "0") {
    effects.push(
      accountName
        ? t("sales.correction.effectCash", {
            account: accountName,
            amount: money(settlement.receivedMinorUnits),
          })
        : t("sales.correction.effectCashAccountUnknown", {
            amount: money(settlement.receivedMinorUnits),
          }),
    );
  }
  if (settlement.creditMinorUnits !== "0") {
    effects.push(
      t("sales.correction.effectDebt", {
        amount: money(settlement.creditMinorUnits),
        customer: settlement.customerName ?? "",
      }),
      t("sales.correction.effectDebtPaid"),
    );
  }
  return (
    <Alert icon={Info} role="note">
      <AlertDescription>{`${t("sales.correction.effectsTitle")}: ${effects.join(" ")}`}</AlertDescription>
    </Alert>
  );
}

/** A prepared correction: its key is minted once and reused by every retry of this review. */
type CorrectionReview = { businessId: string; saleId: string } & (
  | { kind: "void"; command: VoidSaleRequest }
  | { kind: "replacement"; command: ReplaceSaleRequest }
);

export default function SaleCorrectionScreen() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canCorrect = business?.access.permissions.includes("sales:correct") ?? false;
  const saleResult = useQuery(saleQueryOptions(canCorrect ? business?.id : undefined, saleId));
  const sale = saleResult.data?.sale;
  const details = saleResult.data?.details ?? null;
  const accountId = details?.settlement.accountId ?? null;
  const accountOptions = useQuery(
    saleFormOptionsQueryOptions(
      accountId && business?.access.permissions.includes("sales:create") ? business.id : undefined,
    ),
  );
  const accountName = accountId
    ? (accountOptions.data?.accounts.find(({ id }) => id === accountId)?.name ?? null)
    : null;
  useRouteLabel("/operate/sales/[saleId]", sale ? saleAmount(sale, locale) : undefined);
  const [mode, setMode] = useState<CorrectionMode>("void");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [draft, setDraft] = useState<SaleDraftValues>(emptySaleDraft);
  const [draftErrors, setDraftErrors] = useState<SaleDraftErrors>({});
  const [review, setReview] = useState<CorrectionReview | null>(null);
  const mounted = useRef(true);
  const editRef = useRef<View>(null);
  const reasonRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const timeRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const fieldRefs: SaleDraftFieldRefs = {
    amount: amountRef,
    time: timeRef,
    description: descriptionRef,
  };
  // A step change or a rejected draft moves focus to where the person continues. A review
  // focuses Editar, never the irreversible commit, so a repeated key press cannot correct.
  const pendingFocus = useRef<"edit" | "reason" | keyof SaleDraftValues | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === "edit") editRef.current?.focus();
    else if (target === "reason") reasonRef.current?.focus();
    else if (target && target !== "date") fieldRefs[target].current?.focus();
  });

  const saleHref = (id: string) =>
    ({ pathname: "/operate/sales/[saleId]", params: { saleId: id } }) as const;
  const correction = useKeyedCommand({
    keyOf: (input: CorrectionReview) => input.command.idempotencyKey,
    mutationFn: (input: CorrectionReview) =>
      input.kind === "void"
        ? api.sales.void(input.saleId, input.command)
        : api.sales.replace(input.saleId, input.command),
    onConfirmed: async (result, input) => {
      // Voiding an itemized sale also returns stock, cash and debts.
      await invalidateBusinessReads(queryClient, input.businessId);
      const replacement = result.replacementSale;
      notify.success(
        replacement ? t("sales.correction.replaced") : t("sales.correction.voided"),
        replacement
          ? {
              action: {
                label: t("sales.correction.viewReplacement"),
                onPress: () => router.navigate(saleHref(replacement.id)),
              },
              description: saleAmount(replacement, locale),
            }
          : {
              action: {
                label: t("sales.viewSale"),
                onPress: () => router.navigate(saleHref(input.saleId)),
              },
              description: saleAmount(result.originalSale, locale),
            },
      );
      // The toast links to the result when the person already left this screen.
      if (mounted.current) router.replace(saleHref(input.saleId));
    },
  });

  const access = readState([businesses]);
  if (access === "denied" || hasDeniedRead([saleResult]) || (business && !canCorrect)) {
    return (
      <RouteState
        description={t("sales.correction.deniedDescription")}
        kind="denied"
        title={t("sales.correction.deniedTitle")}
        width="form"
      />
    );
  }
  if (access === "error") {
    return (
      <RouteState
        description={t("sales.unavailableDescription")}
        kind="error"
        onRetry={() => void businesses.refetch()}
        title={t("sales.unavailableTitle")}
        width="form"
      />
    );
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  const missing = access === "ready" && !saleId;
  const read = access === "ready" ? readState([saleResult]) : access;
  if (missing || (read === "error" && readFailureKind(saleResult.error) === "notFound")) {
    return (
      <RouteState
        action={
          <Link asChild href="/operate/sales">
            <Button accessibilityRole="link" size="sm" variant="outline">
              <Text>{t("sales.goToSales")}</Text>
            </Button>
          </Link>
        }
        description={t("sales.detail.notFoundDescription")}
        kind="notFound"
        title={t("sales.detail.notFoundTitle")}
        width="form"
      />
    );
  }
  if (read === "error") {
    return (
      <RouteState
        description={t("sales.detail.unavailableDescription")}
        kind="error"
        onRetry={() => void saleResult.refetch()}
        title={t("sales.detail.unavailableTitle")}
        width="form"
      />
    );
  }
  if (read === "offline") return <RouteState kind="offline" width="form" />;
  if (!sale || !business) {
    return (
      <RouteState kind="loading" label={t("sales.detail.loading")} variant="form" width="form" />
    );
  }
  // A confirmed correction refreshes the sale before navigating to it; while that runs the sale is
  // no longer correctable, but the screen keeps its review instead of claiming it cannot proceed.
  if (!canCorrectSale(sale) && !correction.isPending && !correction.isSuccess) {
    return (
      <RouteState
        action={
          <Link asChild href={saleHref(sale.id)}>
            <Button accessibilityRole="link" size="sm" variant="outline">
              <Text>{t("sales.viewSale")}</Text>
            </Button>
          </Link>
        }
        description={t("sales.correction.unavailableDescription")}
        kind="unavailable"
        title={t("sales.correction.unavailableTitle")}
        width="form"
      />
    );
  }

  const isStale = queryHasStaleData(businesses) || queryHasStaleData(saleResult);
  // An unknown outcome stays unknown through later refusals of the same key.
  const ambiguousFailure = correction.phase === "uncertain";
  const confirmationLocked = correction.isPending || ambiguousFailure || correction.isSuccess;
  const leave = () => {
    if (!confirmationLocked) router.replace(saleHref(sale.id));
  };

  const prepareReview = () => {
    if (confirmationLocked || isStale) return;
    const trimmedReason = reason.trim();
    const nextReasonError =
      trimmedReason.length < 2 || trimmedReason.length > 240
        ? t("sales.correction.reasonValidation")
        : undefined;
    setReasonError(nextReasonError);
    if (nextReasonError) {
      pendingFocus.current = "reason";
      return;
    }

    if (mode === "void") {
      setReview({
        businessId: business.id,
        command: { idempotencyKey: Crypto.randomUUID(), reason: trimmedReason },
        kind: "void",
        saleId: sale.id,
      });
      correction.reset();
      pendingFocus.current = "edit";
      return;
    }

    // The server posts the replacement with the business's current currency and time zone.
    const validation = validateSaleDraft(draft, business.currencyMinorUnitDigits);
    setDraftErrors(saleDraftErrors(validation.issues, business.currencyMinorUnitDigits, t));
    if (!validation.draft) {
      pendingFocus.current = firstInvalidField(validation.issues) ?? null;
      return;
    }
    setReview({
      businessId: business.id,
      command: {
        idempotencyKey: Crypto.randomUUID(),
        reason: trimmedReason,
        replacement: validation.draft,
      },
      kind: "replacement",
      saleId: sale.id,
    });
    correction.reset();
    pendingFocus.current = "edit";
  };
  const chooseMode = (next: CorrectionMode) => {
    setMode(next);
    // Most replacements fix one value, so an untouched replacement starts from the original
    // sale. The replacement is posted with the business's current currency and time zone, so
    // the amount and the moment are only reused when those settings still match the sale.
    if (next !== "replacement" || Object.values(draft).some(Boolean)) return;
    const sameMoney =
      sale.currency === business.currency &&
      sale.currencyMinorUnitDigits === business.currencyMinorUnitDigits;
    const sameZone = sale.timeZone === business.timeZone;
    setDraft({
      amount: sameMoney ? toDecimalString(sale.grossMinorUnits, sale.currencyMinorUnitDigits) : "",
      date: sameZone ? sale.occurredLocalDate : "",
      time: sameZone ? sale.occurredLocalTime : "",
      description: sale.description ?? "",
    });
  };

  const original = (
    <Section title={t("sales.correction.original")}>
      <DescriptionList
        items={[
          ...saleFactItems(sale, locale, t),
          ...(details
            ? [
                {
                  label: t("sales.detail.customer"),
                  value: details.settlement.customerName ?? t("sales.itemized.counterSale"),
                },
              ]
            : []),
        ]}
      />
    </Section>
  );
  const effects = details ? (
    <VoidEffects accountName={accountName} details={details} locale={locale} sale={sale} t={t} />
  ) : null;
  const staleNotice = isStale ? (
    <StaleNotice
      loading={businesses.isFetching || saleResult.isFetching}
      onRetry={() => {
        void businesses.refetch();
        void saleResult.refetch();
      }}
    />
  ) : null;

  if (review) {
    return (
      <Page width="form">
        <PageHeader
          description={t("sales.correction.reviewDescription")}
          title={t("sales.correction.reviewTitle")}
        />
        {staleNotice}
        <StatGroup>
          <Stat
            detail={saleMoment(sale, locale)}
            label={
              review.kind === "void"
                ? t("sales.correction.voidTarget")
                : t("sales.correction.original")
            }
            value={saleAmount(sale, locale)}
          />
          {review.kind === "replacement" ? (
            <Stat
              detail={saleMoment(review.command.replacement, locale)}
              label={t("sales.correction.replacement")}
              value={saleAmount(
                {
                  ...review.command.replacement,
                  currency: business.currency,
                  currencyMinorUnitDigits: business.currencyMinorUnitDigits,
                },
                locale,
              )}
            />
          ) : null}
        </StatGroup>
        <DescriptionList
          items={[
            {
              label: t("sales.correction.kind"),
              value:
                review.kind === "void"
                  ? t("sales.correction.kindVoid")
                  : t("sales.correction.kindReplacement"),
            },
            { label: t("sales.correction.reason"), value: review.command.reason },
            ...(review.kind === "replacement"
              ? [
                  saleDescriptionItem(
                    sale.description,
                    t,
                    t("sales.correction.originalDescription"),
                  ),
                  saleDescriptionItem(
                    review.command.replacement.description,
                    t,
                    t("sales.correction.newDescription"),
                  ),
                ]
              : [saleDescriptionItem(sale.description, t)]),
          ]}
        />
        {effects}
        {correction.error ? (
          <Alert
            icon={ambiguousFailure ? TriangleAlert : CircleAlert}
            variant={ambiguousFailure ? "warning" : "destructive"}
          >
            <AlertDescription>
              {ambiguousFailure
                ? t("sales.correction.uncertain")
                : productErrorMessage(correction.error, t("sales.correction.failed"), t, "sale")}
            </AlertDescription>
          </Alert>
        ) : null}
        <ActionBar>
          <Button
            disabled={confirmationLocked}
            label={t("common.cancel")}
            onPress={leave}
            variant="outline"
          />
          {!ambiguousFailure ? (
            <Button
              disabled={confirmationLocked}
              label={t("sales.edit")}
              onPress={() => {
                if (confirmationLocked) return;
                setReview(null);
                correction.reset();
                pendingFocus.current = "reason";
              }}
              ref={editRef}
              variant="outline"
            />
          ) : null}
          <Button
            disabled={correction.isSuccess || (isStale && !ambiguousFailure)}
            label={
              ambiguousFailure
                ? t("common.retrySameConfirmation")
                : review.kind === "void"
                  ? t("sales.correction.confirmVoid")
                  : t("sales.correction.confirmReplace")
            }
            loading={correction.isPending}
            onPress={() => {
              if (correction.isPending || correction.isSuccess) return;
              if (!isStale || ambiguousFailure) correction.send(review);
            }}
            variant={review.kind === "void" ? "destructive" : "default"}
          />
        </ActionBar>
      </Page>
    );
  }

  return (
    <Page width="form">
      <PageHeader
        description={
          details ? t("sales.correction.itemizedDescription") : t("sales.correction.description")
        }
        title={details ? t("sales.correction.voidItemized") : t("sales.correction.title")}
      />
      {staleNotice}
      {original}
      {effects}
      <Section title={t("sales.correction.details")}>
        <View className="gap-5">
          {details ? null : <CorrectionModeField onChange={chooseMode} value={mode} />}
          <Field
            error={reasonError}
            label={t("sales.correction.reason")}
            maxLength={240}
            onChangeText={setReason}
            placeholder={t("sales.correction.reasonPlaceholder")}
            ref={reasonRef}
            value={reason}
          />
        </View>
      </Section>
      {mode === "replacement" ? (
        <Section
          description={t("sales.correction.replacementHint")}
          title={t("sales.correction.replacement")}
        >
          <SaleDraftFields
            currency={business.currency}
            currencyMinorUnitDigits={business.currencyMinorUnitDigits}
            errors={draftErrors}
            fieldRefs={fieldRefs}
            onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
            values={draft}
          />
        </Section>
      ) : null}
      <ActionBar>
        <Button
          disabled={confirmationLocked}
          label={t("common.cancel")}
          onPress={leave}
          variant="outline"
        />
        <Button
          disabled={isStale || confirmationLocked}
          label={t("sales.correction.review")}
          onPress={prepareReview}
          variant="default"
        />
      </ActionBar>
    </Page>
  );
}
