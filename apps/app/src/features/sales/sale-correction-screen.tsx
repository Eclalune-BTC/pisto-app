import type { ReplaceSaleRequest, VoidSaleRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData, readFailureKind } from "@/lib/query-state";
import { ActionBar } from "./action-bar";
import { type CorrectionMode, CorrectionModeField } from "./correction-mode-field";
import { invalidateSaleReads, saleQueryOptions } from "./queries";
import { SalesRouteState } from "./route-state";
import {
  emptySaleDraft,
  type SaleDraftErrors,
  type SaleDraftValues,
  saleDraftErrors,
  validateSaleDraft,
} from "./sale-draft";
import { SaleDraftFields } from "./sale-draft-fields";
import { saleAmount, saleDescriptionItem, saleFactItems, saleMoment } from "./sale-facts";
import { canCorrectSale, readState } from "./state";

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
  useRouteLabel("/operate/sales/[saleId]", sale ? saleAmount(sale, locale) : undefined);
  const [mode, setMode] = useState<CorrectionMode>("void");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [draft, setDraft] = useState<SaleDraftValues>(emptySaleDraft);
  const [draftErrors, setDraftErrors] = useState<SaleDraftErrors>({});
  const [review, setReview] = useState<CorrectionReview | null>(null);
  const mounted = useRef(true);
  const confirmRef = useRef<View>(null);
  const reasonRef = useRef<TextInput>(null);
  // A step change replaces the content under the focused control, so focus follows the step.
  const pendingFocus = useRef<"confirm" | "reason" | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (pendingFocus.current === "confirm") confirmRef.current?.focus();
    if (pendingFocus.current === "reason") reasonRef.current?.focus();
    pendingFocus.current = null;
  });

  const saleHref = (id: string) =>
    ({ pathname: "/operate/sales/[saleId]", params: { saleId: id } }) as const;
  const correction = useMutation({
    mutationFn: (input: CorrectionReview) =>
      input.kind === "void"
        ? api.sales.void(input.saleId, input.command)
        : api.sales.replace(input.saleId, input.command),
    onSuccess: async (result, input) => {
      await invalidateSaleReads(queryClient, input.businessId);
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
      <SalesRouteState
        description={t("sales.correction.deniedDescription")}
        kind="denied"
        title={t("sales.correction.deniedTitle")}
        width="form"
      />
    );
  }
  if (access === "error") {
    return (
      <SalesRouteState
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
      <SalesRouteState
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
      <SalesRouteState
        description={t("sales.detail.unavailableDescription")}
        kind="error"
        onRetry={() => void saleResult.refetch()}
        title={t("sales.detail.unavailableTitle")}
        width="form"
      />
    );
  }
  if (read === "offline") return <SalesRouteState kind="offline" width="form" />;
  if (!sale || !business) {
    return (
      <SalesRouteState
        kind="loading"
        label={t("sales.detail.loading")}
        variant="form"
        width="form"
      />
    );
  }
  // A confirmed correction refreshes the sale before navigating to it; while that runs the sale is
  // no longer correctable, but the screen keeps its review instead of claiming it cannot proceed.
  if (!canCorrectSale(sale) && !correction.isPending && !correction.isSuccess) {
    return (
      <SalesRouteState
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
  const ambiguousFailure = isAmbiguousMutationError(correction.error);
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
    if (nextReasonError) return;

    if (mode === "void") {
      setReview({
        businessId: business.id,
        command: { idempotencyKey: Crypto.randomUUID(), reason: trimmedReason },
        kind: "void",
        saleId: sale.id,
      });
      correction.reset();
      pendingFocus.current = "confirm";
      return;
    }

    // The server posts the replacement with the business's current currency and time zone.
    const validation = validateSaleDraft(draft, business.currencyMinorUnitDigits);
    setDraftErrors(saleDraftErrors(validation.issues, business.currencyMinorUnitDigits, t));
    if (!validation.draft) return;
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
    pendingFocus.current = "confirm";
  };

  const original = (
    <Section title={t("sales.correction.original")}>
      <DescriptionList items={saleFactItems(sale, locale, t)} />
    </Section>
  );
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
              if (!isStale || ambiguousFailure) correction.mutate(review);
            }}
            ref={confirmRef}
            variant={review.kind === "void" ? "destructive" : "default"}
          />
        </ActionBar>
      </Page>
    );
  }

  return (
    <Page width="form">
      <PageHeader
        description={t("sales.correction.description")}
        title={t("sales.correction.title")}
      />
      {staleNotice}
      {original}
      <Section title={t("sales.correction.details")}>
        <View className="gap-5">
          <CorrectionModeField onChange={setMode} value={mode} />
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
