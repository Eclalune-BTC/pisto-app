import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle2, Pencil, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

export default function SaleResultScreen() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const router = useRouter();
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
  const result = useQuery({
    enabled: Boolean(saleId),
    queryFn: () => api.sales.get(saleId as string),
    queryKey: ["sales", "detail", saleId],
  });
  const businesses = useQuery(businessesQueryOptions);

  if (result.fetchStatus === "paused" && !result.data) return <OfflineState />;

  if (result.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
          {t("sales.resultLoading")}
        </Text>
      </View>
    );
  }

  if (!result.data) {
    return (
      <View className="flex-1 items-start justify-center gap-4 px-5 sm:px-8 lg:px-10">
        <Text className="text-xl font-black text-ink dark:text-white">
          {t("sales.resultFailedTitle")}
        </Text>
        <Text className="max-w-[460px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {t("sales.resultFailedDescription")}
        </Text>
        <View className="gap-3 sm:flex-row">
          <Button label={t("common.retry")} onPress={() => result.refetch()} variant="secondary" />
          <Button label={t("sales.goToSales")} onPress={() => router.replace("/operate/sales")} />
        </View>
      </View>
    );
  }

  const { sale } = result.data;
  const business = getActiveBusiness(businesses.data);
  const canCorrect = business?.access.permissions.includes("sales:correct") ?? false;
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

      <View className="flex-row items-start gap-4">
        <CheckCircle2 color="#237A55" size={30} strokeWidth={2.4} />
        <View className="min-w-0 flex-1">
          <ScreenHeader
            description={t("sales.resultDescription")}
            eyebrow={t("sales.resultEyebrow")}
            title={formatMinorUnits(
              sale.grossMinorUnits,
              sale.currency,
              sale.currencyMinorUnitDigits,
              locale,
            )}
          />
        </View>
      </View>

      {result.isError ? <StaleNotice /> : null}

      <DetailList
        items={[
          {
            label: t("common.status"),
            value: sale.status === "posted" ? t("sales.posted") : t("sales.voided"),
          },
          { label: t("common.localDate"), value: sale.occurredLocalDate },
          { label: t("common.localTime"), value: sale.occurredLocalTime },
          { label: t("common.timeZone"), value: sale.timeZone },
          { label: t("common.currency"), value: sale.currency },
          {
            label: t("common.description"),
            value: sale.description ?? t("common.noDescription"),
          },
          { label: t("common.identifier"), value: sale.id },
          ...(sale.correction
            ? [
                {
                  label: t("sales.correction.action"),
                  value:
                    sale.correction.kind === "replacement"
                      ? t("sales.correction.replaceAction")
                      : t("sales.correction.voidAction"),
                },
                { label: t("sales.correction.reason"), value: sale.correction.reason },
                ...(sale.correction.replacementSaleId
                  ? [
                      {
                        label: t("sales.correction.replacementIdentifier"),
                        value: sale.correction.replacementSaleId,
                      },
                    ]
                  : []),
              ]
            : []),
        ]}
      />

      <View className="gap-3 sm:flex-row">
        {sale.status === "posted" && canCorrect ? (
          <Button
            onPress={() =>
              router.push({
                pathname: "/operate/sales/correct/[saleId]",
                params: { saleId: sale.id },
              })
            }
            variant="secondary"
          >
            <Pencil color="#237A55" size={18} />
            <ButtonText variant="secondary">{t("sales.correction.open")}</ButtonText>
          </Button>
        ) : null}
        <Button onPress={() => router.replace("/operate/sales/new")} variant="accent">
          <Plus color="#14241D" size={18} />
          <ButtonText variant="accent">{t("sales.registerAnother")}</ButtonText>
        </Button>
        <Button
          label={t("sales.viewSummary")}
          onPress={() => router.replace("/operate/sales")}
          variant="secondary"
        />
      </View>
    </Page>
  );
}
