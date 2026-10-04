import type { Business, SaleReview } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { currentLocalDateTime, toDecimalString } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import { ActionBar } from "./action-bar";
import { invalidateSaleReads, saleQueryKeys, saleReviewQueryOptions } from "./queries";
import { SalesRouteState } from "./route-state";
import {
  emptySaleDraft,
  type SaleDraftErrors,
  type SaleDraftValues,
  saleDraftErrors,
  validateSaleDraft,
} from "./sale-draft";
import { SaleDraftFields } from "./sale-draft-fields";
import { saleAmount, saleFactItems } from "./sale-facts";
import { readState } from "./state";

export default function NewSaleScreen() {
  const { t } = useTranslation();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const read = readState([businesses]);
  if (read === "denied" || (business && !business.access.permissions.includes("sales:create"))) {
    return (
      <SalesRouteState
        description={t("sales.new.deniedDescription")}
        kind="denied"
        title={t("sales.new.deniedTitle")}
        width="form"
      />
    );
  }
  if (read === "offline") return <SalesRouteState kind="offline" width="form" />;
  if (read === "loading") {
    return (
      <SalesRouteState kind="loading" label={t("sales.loading")} variant="form" width="form" />
    );
  }
  if (read === "error") {
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
  if (!business) return <Redirect href="/business" />;
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

/**
 * New-sale entry with server-owned review recovery (ADR 0018). Opening or reloading only reads;
 * preparing stores a working review, and only the explicit confirmation posts the sale with the
 * review's original idempotency key.
 */
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
  const [draft, setDraft] = useState<SaleDraftValues>(emptySaleDraft);
  const [errors, setErrors] = useState<SaleDraftErrors>({});
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
  const saleHref = (saleId: string) =>
    ({ pathname: "/operate/sales/[saleId]", params: { saleId } }) as const;
  const openSale = (saleId: string) => router.replace(saleHref(saleId));
  const recheck = () => {
    onRefreshBusiness();
    void recovery.refetch();
  };

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
      await invalidateSaleReads(client, business.id);
      notify.success(t("sales.new.created"), {
        action: { label: t("sales.viewSale"), onPress: () => router.push(saleHref(sale.id)) },
        description: saleAmount(sale, locale),
      });
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
      // A confirmation won the race with this edit or discard: the sale exists and is shown.
      if (saleId && selected.saleId === null) {
        notify.warning(t("sales.new.alreadySaved"));
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
          : emptySaleDraft,
      );
      setErrors({});
      preparation.reset();
      confirmation.reset();
    },
    onError: refresh,
    onSettled: afterAction,
  });

  if (hasDeniedRead([recovery])) {
    return (
      <SalesRouteState
        description={t("sales.new.deniedDescription")}
        kind="denied"
        title={t("sales.new.deniedTitle")}
        width="form"
      />
    );
  }
  if (recovery.fetchStatus === "paused" && !recovery.data) {
    return <SalesRouteState kind="offline" width="form" />;
  }
  if (recovery.isPending) {
    return (
      <SalesRouteState kind="loading" label={t("sales.new.loading")} variant="form" width="form" />
    );
  }

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
    setErrors(saleDraftErrors(validation.issues, business.currencyMinorUnitDigits, t));
    const reviewedDraft = validation.draft;
    if (reviewedDraft)
      act(() => preparation.mutate({ idempotencyKey: Crypto.randomUUID(), ...reviewedDraft }));
  };
  const actionError = dismissal.error ?? (review?.saleId ? null : confirmation.error);
  const uncertain = isAmbiguousMutationError(actionError);
  const confirmationUncertain = uncertain && actionError === confirmation.error;
  const failure = actionError
    ? uncertain
      ? t("sales.recovery.uncertain")
      : productErrorMessage(actionError, t("sales.recovery.actionFailed"), t, "sale")
    : recovery.isError
      ? t("sales.recovery.unavailable")
      : preparation.isError && !review
        ? t("sales.recovery.prepareFailed")
        : null;
  const header = review?.saleId
    ? { title: t("sales.new.savedTitle"), description: t("sales.new.savedDescription") }
    : review
      ? { title: t("sales.new.reviewTitle"), description: t("sales.new.reviewDescription") }
      : { title: t("sales.new.title"), description: t("sales.new.description") };
  const dismissing = (edit: boolean) => dismissal.isPending && dismissal.variables?.edit === edit;

  return (
    <Page width="form">
      <PageHeader description={header.description} title={header.title} />
      {contextChanged ? (
        <Alert
          action={
            <Button label={t("common.retry")} onPress={recheck} size="sm" variant="outline" />
          }
          icon={TriangleAlert}
          variant="warning"
        >
          <AlertDescription>{t("sales.recovery.contextChanged")}</AlertDescription>
        </Alert>
      ) : null}
      {stale ? (
        <StaleNotice loading={businessFetching || recovery.isFetching} onRetry={recheck} />
      ) : null}
      {failure ? (
        <Alert
          action={
            <Button
              label={t("sales.recovery.refresh")}
              loading={recovery.isFetching}
              onPress={recheck}
              size="sm"
              variant="outline"
            />
          }
          icon={uncertain ? TriangleAlert : CircleAlert}
          variant={uncertain ? "warning" : "destructive"}
        >
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}
      {review && !contextChanged ? (
        <>
          <DescriptionList
            items={[
              ...saleFactItems(
                {
                  ...review.command,
                  currency: review.currency,
                  currencyMinorUnitDigits: review.currencyMinorUnitDigits,
                },
                locale,
                t,
              ),
              { label: t("common.currency"), value: review.currency },
              { label: t("common.timeZone"), value: review.timeZone },
            ]}
          />
          {settingsChanged ? (
            <Alert icon={TriangleAlert} variant="warning">
              <AlertDescription>{t("sales.recovery.settingsChanged")}</AlertDescription>
            </Alert>
          ) : null}
          {review.saleId ? (
            <ActionBar>
              <Button
                disabled={blocked}
                label={t("sales.registerAnother")}
                loading={dismissal.isPending}
                onPress={() => act(() => dismissal.mutate({ review, edit: false }))}
                variant="outline"
              />
              <Button
                label={t("sales.viewSale")}
                onPress={() => {
                  if (review.saleId) openSale(review.saleId);
                }}
              />
            </ActionBar>
          ) : (
            <>
              <Text className="text-[13px] leading-5 text-muted-foreground">
                {t("sales.new.retained")}
              </Text>
              <ActionBar
                leading={
                  <Button
                    disabled={blocked}
                    label={t("sales.new.discard")}
                    loading={dismissing(false)}
                    onPress={() => act(() => dismissal.mutate({ review, edit: false }))}
                    variant="ghost"
                  />
                }
              >
                <Button
                  disabled={blocked}
                  label={t("sales.edit")}
                  loading={dismissing(true)}
                  onPress={() => act(() => dismissal.mutate({ review, edit: true }))}
                  variant="outline"
                />
                <Button
                  disabled={blocked || settingsChanged}
                  label={
                    confirmationUncertain
                      ? t("common.retrySameConfirmation")
                      : t("sales.new.confirm")
                  }
                  loading={confirmation.isPending}
                  onPress={() => {
                    if (!settingsChanged) act(() => confirmation.mutate(review.id));
                  }}
                />
              </ActionBar>
            </>
          )}
        </>
      ) : recovery.data && !contextChanged ? (
        <>
          <SaleDraftFields
            currency={business.currency}
            currencyMinorUnitDigits={business.currencyMinorUnitDigits}
            errors={errors}
            onChange={(field, value) => setDraft((previous) => ({ ...previous, [field]: value }))}
            timeZone={business.timeZone}
            values={draft}
          />
          <ActionBar>
            <Button
              disabled={pending}
              label={t("common.cancel")}
              onPress={() => {
                if (!pending) router.replace("/operate/sales");
              }}
              variant="outline"
            />
            <Button
              disabled={blocked}
              label={t("sales.new.review")}
              loading={preparation.isPending}
              onPress={prepareReview}
            />
          </ActionBar>
        </>
      ) : null}
    </Page>
  );
}
