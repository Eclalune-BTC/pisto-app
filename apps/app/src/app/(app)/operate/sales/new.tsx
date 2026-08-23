import type { CreateSaleRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { saleQueryKeys } from "@/features/sales/queries";
import {
  type SaleDraftIssues,
  type SaleDraftValues,
  validateSaleDraft,
} from "@/features/sales/sale-draft";
import { SaleDraftFields } from "@/features/sales/sale-draft-fields";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { api, isAmbiguousMutationError } from "@/lib/api-client";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

type DraftErrors = Partial<Record<keyof SaleDraftValues, string>>;

export default function NewSaleScreen() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const router = useRouter();
  const queryClient = useQueryClient();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<DraftErrors>({});
  const [command, setCommand] = useState<CreateSaleRequest | null>(null);

  useEffect(() => {
    if (business && !date && !time) {
      const current = currentLocalDateTime(business.timeZone);
      setDate(current.date);
      setTime(current.time);
    }
  }, [business, date, time]);

  const confirmation = useMutation({
    mutationFn: api.sales.create,
    onSuccess: async ({ sale }) => {
      await queryClient.invalidateQueries({
        queryKey: saleQueryKeys.all(business?.id ?? "unselected"),
      });
      router.replace({ pathname: "/operate/sales/[saleId]", params: { saleId: sale.id } });
    },
  });

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
      </View>
    );
  }
  if (!business) return <Redirect href="/business" />;

  const prepareReview = () => {
    const validation = validateSaleDraft(
      { amount, date, time, description },
      business.currencyMinorUnitDigits,
    );
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
    const nextErrors = Object.fromEntries(
      Object.entries(validation.issues).map(([field, issue]) => [field, messages[issue]]),
    ) as DraftErrors;
    setErrors(nextErrors);
    if (!validation.draft) return;
    setCommand({
      idempotencyKey: Crypto.randomUUID(),
      ...validation.draft,
    });
    confirmation.reset();
  };

  const ambiguousFailure = isAmbiguousMutationError(confirmation.error);

  return (
    <Page width="form">
      <Button
        className="self-start px-0"
        onPress={() => router.replace("/operate/sales")}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {t("sales.back")}
        </ButtonText>
      </Button>

      <ScreenHeader
        description={command ? t("sales.reviewDescription") : t("sales.newDescription")}
        eyebrow={command ? t("sales.reviewEyebrow") : business.name}
        title={command ? t("sales.reviewTitle") : t("sales.newTitle")}
      />

      {businesses.isError && businesses.data ? <StaleNotice /> : null}

      {command ? (
        <View className="gap-7">
          <DetailList
            items={[
              {
                label: t("sales.total"),
                value: formatMinorUnits(
                  command.grossMinorUnits,
                  business.currency,
                  business.currencyMinorUnitDigits,
                  locale,
                ),
              },
              { label: t("common.localDate"), value: command.occurredLocalDate },
              { label: t("common.localTime"), value: command.occurredLocalTime },
              { label: t("common.timeZone"), value: business.timeZone },
              { label: t("common.currency"), value: business.currency },
              {
                label: t("common.description"),
                value: command.description ?? t("common.noDescription"),
              },
            ]}
          />

          {confirmation.error ? (
            <View className="flex-row items-start gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
              <AlertTriangle color="#B94242" size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  accessibilityRole="alert"
                  className="font-bold text-danger dark:text-[#FFBABA]"
                >
                  {ambiguousFailure ? t("common.uncertainTitle") : t("sales.failedTitle")}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
                  {ambiguousFailure
                    ? t("sales.uncertainDescription")
                    : productErrorMessage(
                        confirmation.error,
                        t("sales.failedDescription"),
                        t,
                        "sale",
                      )}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="gap-3 sm:flex-row">
            <Button
              accessibilityLabel={t("sales.confirm")}
              loading={confirmation.isPending}
              onPress={() => confirmation.mutate(command)}
              variant="accent"
            >
              <Check color="#14241D" size={18} strokeWidth={2.8} />
              <ButtonText variant="accent">{t("sales.confirm")}</ButtonText>
            </Button>
            {!ambiguousFailure ? (
              <Button
                label={t("sales.edit")}
                onPress={() => {
                  setCommand(null);
                  confirmation.reset();
                }}
                variant="secondary"
              />
            ) : null}
          </View>
        </View>
      ) : (
        <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
          <SaleDraftFields
            currency={business.currency}
            errors={errors}
            labels={{
              amount: t("sales.totalField"),
              date: t("sales.date"),
              datePlaceholder: t("sales.datePlaceholder"),
              description: t("sales.descriptionOptional"),
              descriptionPlaceholder: t("sales.descriptionPlaceholder"),
              time: t("sales.time"),
              timePlaceholder: t("sales.timePlaceholder"),
            }}
            onChange={(field, value) => {
              if (field === "amount") setAmount(value);
              if (field === "date") setDate(value);
              if (field === "time") setTime(value);
              if (field === "description") setDescription(value);
            }}
            values={{ amount, date, time, description }}
          />
          <View className="gap-2">
            <Button
              className="self-start"
              label={t("sales.review")}
              onPress={prepareReview}
              variant="accent"
            />
            <Text className="text-xs leading-5 text-ink-muted dark:text-[#91A198]">
              {t("sales.interpretation", {
                currency: business.currency,
                timeZone: business.timeZone,
              })}
            </Text>
          </View>
        </View>
      )}
    </Page>
  );
}
