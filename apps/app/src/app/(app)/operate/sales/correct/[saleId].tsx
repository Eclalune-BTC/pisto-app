import type { ReplaceSaleRequest, VoidSaleRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { saleQueryKeys, saleQueryOptions } from "@/features/sales/queries";
import {
  type SaleDraftIssues,
  type SaleDraftValues,
  validateSaleDraft,
} from "@/features/sales/sale-draft";
import { SaleDraftFields } from "@/features/sales/sale-draft-fields";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

type CorrectionMode = "void" | "replacement";
type Review =
  | { kind: "void"; command: VoidSaleRequest }
  | { kind: "replacement"; command: ReplaceSaleRequest };
type DraftErrors = Partial<Record<keyof SaleDraftValues, string>>;

export default function CorrectSaleScreen() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const saleResult = useQuery({
    ...saleQueryOptions(business?.id ?? "unselected", saleId ?? ""),
    enabled: Boolean(saleId && business),
  });
  const [mode, setMode] = useState<CorrectionMode>("void");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [draft, setDraft] = useState<SaleDraftValues>({
    amount: "",
    date: "",
    time: "",
    description: "",
  });
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [review, setReview] = useState<Review | null>(null);

  const correction = useMutation({
    mutationFn: (input: Review) =>
      input.kind === "void"
        ? api.sales.void(saleId as string, input.command)
        : api.sales.replace(saleId as string, input.command),
    onSuccess: async () => {
      // A correction voids the original, may create a replacement, and changes
      // both the summary and every history page, so the whole business-scoped
      // sales cache is invalidated rather than the two records it names.
      await queryClient.invalidateQueries({
        queryKey: saleQueryKeys.all(business?.id ?? "unselected"),
      });
      router.replace({ pathname: "/operate/sales/[saleId]", params: { saleId: saleId as string } });
    },
  });

  if (
    (businesses.fetchStatus === "paused" && !businesses.data) ||
    (saleResult.fetchStatus === "paused" && !saleResult.data)
  ) {
    return <OfflineState />;
  }
  if (businesses.isPending || saleResult.isPending) {
    return (
      <View className="flex-1 items-start justify-center px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
      </View>
    );
  }

  const sale = saleResult.data?.sale;
  const canCorrect = business?.access.permissions.includes("sales:correct") ?? false;
  if (!sale || !business || !canCorrect || sale.status !== "posted" || sale.correction) {
    return (
      <Page width="form">
        <ScreenHeader
          description={t("sales.correction.unavailableDescription")}
          eyebrow={t("sales.correction.eyebrow")}
          title={t("sales.correction.unavailableTitle")}
        />
        <Button
          label={t("sales.back")}
          onPress={() =>
            router.replace({
              pathname: "/operate/sales/[saleId]",
              params: { saleId: saleId as string },
            })
          }
          variant="secondary"
        />
      </Page>
    );
  }

  const prepareReview = () => {
    const trimmedReason = reason.trim();
    const nextReasonError =
      trimmedReason.length < 2 || trimmedReason.length > 240
        ? t("sales.correction.reasonValidation")
        : undefined;
    setReasonError(nextReasonError);
    if (nextReasonError) return;

    if (mode === "void") {
      setReview({
        kind: "void",
        command: { idempotencyKey: Crypto.randomUUID(), reason: trimmedReason },
      });
      correction.reset();
      return;
    }

    const validation = validateSaleDraft(draft, sale.currencyMinorUnitDigits);
    const messages: Record<NonNullable<SaleDraftIssues[keyof SaleDraftIssues]>, string> = {
      "invalid-decimals": t("sales.validation.amountDecimals", {
        count: sale.currencyMinorUnitDigits,
      }),
      "invalid-integer": t("sales.validation.amountInteger"),
      "non-positive": t("sales.validation.amountPositive"),
      "too-large": t("sales.validation.amountTooLarge"),
      "invalid-date": t("sales.validation.date"),
      "invalid-time": t("sales.validation.time"),
      "description-too-long": t("sales.validation.description"),
    };
    setDraftErrors(
      Object.fromEntries(
        Object.entries(validation.issues).map(([field, issue]) => [field, messages[issue]]),
      ) as DraftErrors,
    );
    if (!validation.draft) return;
    setReview({
      kind: "replacement",
      command: {
        idempotencyKey: Crypto.randomUUID(),
        reason: trimmedReason,
        replacement: validation.draft,
      },
    });
    correction.reset();
  };

  const ambiguousFailure = isAmbiguousMutationError(correction.error);
  const originalAmount = formatMinorUnits(
    sale.grossMinorUnits,
    sale.currency,
    sale.currencyMinorUnitDigits,
    locale,
  );

  return (
    <Page width="form">
      <Button
        className="self-start px-0"
        onPress={() =>
          router.replace({ pathname: "/operate/sales/[saleId]", params: { saleId: sale.id } })
        }
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {t("sales.back")}
        </ButtonText>
      </Button>

      <ScreenHeader
        description={
          review ? t("sales.correction.reviewDescription") : t("sales.correction.description")
        }
        eyebrow={t("sales.correction.eyebrow")}
        title={review ? t("sales.correction.reviewTitle") : t("sales.correction.title")}
      />

      {businesses.isError || saleResult.isError ? <StaleNotice /> : null}

      <View className="gap-3 border-y border-line py-5 dark:border-[#304239]">
        <Text className="text-xs font-black uppercase tracking-[1.4px] text-ink-muted dark:text-[#AAB8B0]">
          {t("sales.correction.original")}
        </Text>
        <DetailList
          items={[
            { label: t("sales.total"), value: originalAmount },
            { label: t("common.localDate"), value: sale.occurredLocalDate },
            { label: t("common.localTime"), value: sale.occurredLocalTime },
            {
              label: t("common.description"),
              value: sale.description ?? t("common.noDescription"),
            },
          ]}
        />
      </View>

      {review ? (
        <View className="gap-6">
          <DetailList
            items={[
              {
                label: t("sales.correction.action"),
                value:
                  review.kind === "void"
                    ? t("sales.correction.voidAction")
                    : t("sales.correction.replaceAction"),
              },
              { label: t("sales.correction.reason"), value: review.command.reason },
              ...(review.kind === "replacement"
                ? [
                    {
                      label: t("sales.correction.replacementTotal"),
                      value: formatMinorUnits(
                        review.command.replacement.grossMinorUnits,
                        sale.currency,
                        sale.currencyMinorUnitDigits,
                        locale,
                      ),
                    },
                    {
                      label: t("common.localDate"),
                      value: review.command.replacement.occurredLocalDate,
                    },
                    {
                      label: t("common.localTime"),
                      value: review.command.replacement.occurredLocalTime,
                    },
                  ]
                : []),
            ]}
          />

          {correction.error ? (
            <View className="flex-row items-start gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
              <AlertTriangle color="#B94242" size={20} />
              <Text accessibilityRole="alert" className="min-w-0 flex-1 text-sm text-danger">
                {ambiguousFailure
                  ? t("sales.correction.uncertain")
                  : productErrorMessage(correction.error, t("sales.correction.failed"), t, "sale")}
              </Text>
            </View>
          ) : null}

          <View className="gap-3 sm:flex-row">
            <Button
              loading={correction.isPending}
              onPress={() => correction.mutate(review)}
              variant="accent"
            >
              <Check color="#14241D" size={18} strokeWidth={2.8} />
              <ButtonText variant="accent">{t("sales.correction.confirm")}</ButtonText>
            </Button>
            {!ambiguousFailure ? (
              <Button
                label={t("sales.edit")}
                onPress={() => {
                  setReview(null);
                  correction.reset();
                }}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      ) : (
        <View className="gap-7">
          <View className="gap-3 sm:flex-row">
            <Button
              label={t("sales.correction.voidAction")}
              onPress={() => setMode("void")}
              variant={mode === "void" ? "accent" : "secondary"}
            />
            <Button
              label={t("sales.correction.replaceAction")}
              onPress={() => setMode("replacement")}
              variant={mode === "replacement" ? "accent" : "secondary"}
            />
          </View>
          <Field
            error={reasonError}
            label={t("sales.correction.reason")}
            maxLength={240}
            onChangeText={setReason}
            placeholder={t("sales.correction.reasonPlaceholder")}
            value={reason}
          />
          {mode === "replacement" ? (
            <View className="gap-3">
              <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {t("sales.correction.replacementTimeNote")}
              </Text>
              <SaleDraftFields
                currency={sale.currency}
                errors={draftErrors}
                labels={{
                  amount: t("sales.correction.replacementTotal"),
                  date: t("sales.date"),
                  datePlaceholder: t("sales.datePlaceholder"),
                  description: t("sales.descriptionOptional"),
                  descriptionPlaceholder: t("sales.descriptionPlaceholder"),
                  time: t("sales.time"),
                  timePlaceholder: t("sales.timePlaceholder"),
                }}
                onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
                values={draft}
              />
            </View>
          ) : null}
          <Button
            className="self-start"
            label={t("sales.correction.review")}
            onPress={prepareReview}
            variant="accent"
          />
        </View>
      )}
    </Page>
  );
}
