import type { Business, SaleReview } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { reportsQueryKeys } from "@/features/reports/queries";
import { saleQueryKeys, saleReviewQueryOptions } from "@/features/sales/queries";
import {
  type SaleDraftIssues,
  type SaleDraftValues,
  validateSaleDraft,
} from "@/features/sales/sale-draft";
import { SaleDraftFields } from "@/features/sales/sale-draft-fields";
import { requireSupportedLocale } from "@/i18n/locale";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { currentLocalDateTime, formatMinorUnits, toDecimalString } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";

const emptyDraft: SaleDraftValues = { amount: "", date: "", time: "", description: "" };

export default function NewSaleScreen() {
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  if (hasDeniedRead([businesses])) return <CapabilityRouteState kind="denied" />;
  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;
  if (businesses.isPending) return <ActivityIndicator />;
  if (businesses.isError && !businesses.data)
    return (
      <CapabilityRouteState
        kind="error"
        onRetry={() => {
          void businesses.refetch();
        }}
      />
    );
  if (!business) return <Redirect href="/business" />;
  if (!business.access.permissions.includes("sales:create"))
    return <CapabilityRouteState kind="denied" />;
  return (
    <SaleReviewScreen
      key={business.id}
      business={business}
      businessStale={queryHasStaleData(businesses)}
      businessFetching={businesses.isFetching}
      onRefreshBusiness={() => businesses.refetch()}
    />
  );
}

export function SaleReviewScreen({
  business,
  businessStale,
  businessFetching,
  onRefreshBusiness,
}: {
  business: Business;
  businessStale: boolean;
  businessFetching: boolean;
  onRefreshBusiness: () => unknown;
}) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const client = useQueryClient();
  const reviewKey = saleQueryKeys.review(business.id);
  const recovery = useQuery(saleReviewQueryOptions(business.id));
  const review = recovery.data?.review;
  const [draft, setDraft] = useState<SaleDraftValues>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof SaleDraftValues, string>>>({});
  const acting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!draft.date && !draft.time) {
      setDraft((previous) => ({ ...previous, ...currentLocalDateTime(business.timeZone) }));
    }
  }, [business, draft.date, draft.time]);

  const refresh = () => client.invalidateQueries({ queryKey: reviewKey });
  const beforeAction = () => client.cancelQueries({ queryKey: reviewKey });
  const afterAction = () => {
    acting.current = false;
  };
  const openSale = (saleId: string) =>
    router.replace({
      pathname: "/operate/sales/[saleId]",
      params: { saleId },
    });

  const preparation = useMutation({
    mutationFn: api.sales.review.prepare,
    onMutate: beforeAction,
    onSuccess: (result) => {
      client.setQueryData(reviewKey, result);
      confirmation.reset();
      dismissal.reset();
    },
    onError: refresh,
    onSettled: afterAction,
  });
  const confirmation = useMutation({
    mutationFn: api.sales.review.confirm,
    onMutate: beforeAction,
    onSuccess: async ({ sale }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: saleQueryKeys.all(business.id) }),
        client.invalidateQueries({ queryKey: reportsQueryKeys.all(business.id) }),
      ]);
      if (mounted.current) openSale(sale.id);
    },
    onError: refresh,
    onSettled: afterAction,
  });
  const dismissal = useMutation({
    mutationFn: ({ review: selected }: { review: SaleReview; edit: boolean }) =>
      api.sales.review.dismiss(selected.id, selected.saleId),
    onMutate: beforeAction,
    onSuccess: async ({ saleId }, { review: selected, edit }) => {
      await refresh();
      if (!mounted.current) return;
      if (saleId && selected.saleId === null) {
        openSale(saleId);
        return;
      }
      setDraft(
        edit && !saleId
          ? {
              amount: toDecimalString(
                selected.command.grossMinorUnits,
                selected.currencyMinorUnitDigits,
              ),
              date: selected.command.occurredLocalDate,
              time: selected.command.occurredLocalTime,
              description: selected.command.description ?? "",
            }
          : emptyDraft,
      );
      setErrors({});
      preparation.reset();
      confirmation.reset();
    },
    onError: refresh,
    onSettled: afterAction,
  });

  if (hasDeniedRead([recovery])) return <CapabilityRouteState kind="denied" />;
  if (recovery.fetchStatus === "paused" && !recovery.data) return <OfflineState />;

  const contextChanged = Boolean(review && review.businessId !== business.id);
  const stale = businessStale || queryHasStaleData(recovery);
  const pending = preparation.isPending || confirmation.isPending || dismissal.isPending;
  const blocked =
    stale || contextChanged || pending || recovery.isFetching || recovery.data === undefined;
  const settingsChanged = Boolean(
    review &&
      !review.saleId &&
      (review.currency !== business.currency ||
        review.currencyMinorUnitDigits !== business.currencyMinorUnitDigits ||
        review.timeZone !== business.timeZone),
  );
  const act = (action: () => void) => {
    if (blocked || acting.current) return;
    acting.current = true;
    action();
  };
  const prepareReview = () => {
    if (blocked || acting.current || review) return;
    const validation = validateSaleDraft(draft, business.currencyMinorUnitDigits);
    const messages: Record<NonNullable<SaleDraftIssues[keyof SaleDraftIssues]>, string> = {
      "invalid-decimals": t("sales.validation.amountDecimals", {
        count: business.currencyMinorUnitDigits,
      }),
      "invalid-integer": t("sales.validation.amountInteger"),
      "non-positive": t("sales.validation.amountPositive"),
      "too-large": t("sales.validation.amountTooLarge"),
      "invalid-date": t("sales.validation.date"),
      "invalid-time": t("sales.validation.time"),
      "description-too-long": t("sales.validation.description"),
    };
    setErrors(
      Object.fromEntries(
        Object.entries(validation.issues).map(([field, issue]) => [field, messages[issue]]),
      ),
    );
    const reviewedDraft = validation.draft;
    if (reviewedDraft)
      act(() => preparation.mutate({ idempotencyKey: Crypto.randomUUID(), ...reviewedDraft }));
  };
  const actionError = dismissal.error ?? (review?.saleId ? null : confirmation.error);
  return (
    <Page width="form">
      <Button
        label={t("sales.back")}
        variant="ghost"
        className="self-start"
        disabled={pending}
        onPress={() => {
          if (!pending) router.replace("/operate/sales");
        }}
      />
      <ScreenHeader
        eyebrow={business.name}
        title={
          review?.saleId
            ? t("sales.resultEyebrow")
            : review
              ? t("sales.reviewTitle")
              : t("sales.newTitle")
        }
        description={
          review?.saleId
            ? t("sales.recovery.saved")
            : review
              ? t("sales.reviewDescription")
              : t("sales.newDescription")
        }
      />
      {contextChanged ? (
        <View className="gap-3">
          <Alert>{t("sales.recovery.contextChanged")}</Alert>
          <Button
            label={t("common.retry")}
            variant="secondary"
            onPress={() => {
              onRefreshBusiness();
              void recovery.refetch();
            }}
          />
        </View>
      ) : null}
      {stale ? (
        <StaleNotice
          loading={businessFetching || recovery.isFetching}
          onRetry={() => {
            onRefreshBusiness();
            void recovery.refetch();
          }}
        />
      ) : null}
      {recovery.isPending ? <Text>{t("sales.recovery.loading")}</Text> : null}
      {recovery.isError || (preparation.isError && !review) || actionError ? (
        <View className="gap-3">
          <Alert tone="danger">
            {actionError
              ? isAmbiguousMutationError(actionError)
                ? t("common.uncertainTitle")
                : productErrorMessage(actionError, t("sales.recovery.actionFailed"), t, "sale")
              : t(recovery.isError ? "sales.recovery.unavailable" : "sales.recovery.prepareFailed")}
          </Alert>
          <Button
            label={t("sales.recovery.refresh")}
            variant="secondary"
            loading={recovery.isFetching}
            onPress={() => {
              onRefreshBusiness();
              void recovery.refetch();
            }}
          />
        </View>
      ) : null}
      {review && !contextChanged ? (
        <View className="gap-6">
          <Alert>{t(review.saleId ? "sales.recovery.saved" : "sales.recovery.retained")}</Alert>
          <DetailList
            items={[
              {
                label: t("sales.total"),
                value: formatMinorUnits(
                  review.command.grossMinorUnits,
                  review.currency,
                  review.currencyMinorUnitDigits,
                  locale,
                ),
              },
              { label: t("common.localDate"), value: review.command.occurredLocalDate },
              { label: t("common.localTime"), value: review.command.occurredLocalTime },
              { label: t("common.timeZone"), value: review.timeZone },
              { label: t("common.currency"), value: review.currency },
              {
                label: t("common.description"),
                value: review.command.description ?? t("common.noDescription"),
              },
            ]}
          />
          {settingsChanged ? <Alert>{t("sales.recovery.settingsChanged")}</Alert> : null}
          {review.saleId ? (
            <View className="gap-3">
              <Button
                label={t("sales.recovery.open")}
                variant="accent"
                onPress={() => {
                  if (review.saleId) openSale(review.saleId);
                }}
              />
              <Button
                label={t("sales.registerAnother")}
                variant="secondary"
                disabled={blocked}
                loading={dismissal.isPending}
                onPress={() => act(() => dismissal.mutate({ review, edit: false }))}
              />
            </View>
          ) : (
            <View className="gap-3">
              <Button
                label={t("sales.confirm")}
                variant="accent"
                disabled={blocked || settingsChanged}
                loading={confirmation.isPending}
                onPress={() => {
                  if (!settingsChanged) act(() => confirmation.mutate(review.id));
                }}
              />
              <Button
                label={t("sales.edit")}
                variant="secondary"
                disabled={blocked}
                loading={dismissal.isPending}
                onPress={() => act(() => dismissal.mutate({ review, edit: true }))}
              />
              <Button
                label={t("sales.recovery.discard")}
                variant="ghost"
                disabled={blocked}
                onPress={() => act(() => dismissal.mutate({ review, edit: false }))}
              />
            </View>
          )}
        </View>
      ) : recovery.data && !contextChanged ? (
        <View className="gap-6">
          <SaleDraftFields
            currency={business.currency}
            errors={errors}
            values={draft}
            labels={{
              amount: t("sales.totalField"),
              date: t("sales.date"),
              datePlaceholder: t("sales.datePlaceholder"),
              description: t("sales.descriptionOptional"),
              descriptionPlaceholder: t("sales.descriptionPlaceholder"),
              time: t("sales.time"),
              timePlaceholder: t("sales.timePlaceholder"),
            }}
            onChange={(field, value) => setDraft((previous) => ({ ...previous, [field]: value }))}
          />
          <Button
            label={t("sales.review")}
            variant="accent"
            disabled={blocked}
            loading={preparation.isPending}
            onPress={prepareReview}
          />
          <Text className="text-sm text-muted-foreground">
            {t("sales.interpretation", {
              currency: business.currency,
              timeZone: business.timeZone,
            })}
          </Text>
        </View>
      ) : null}
    </Page>
  );
}
