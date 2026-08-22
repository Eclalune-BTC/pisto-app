import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { deriveBillingAccessState } from "@/lib/billing/billing-access";

export default function BillingSuccessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [verifiedAfterReturn, setVerifiedAfterReturn] = useState(false);
  const { checkout_id: checkoutId } = useLocalSearchParams<{ checkout_id?: string }>();
  const entitlements = useQuery({
    enabled: false,
    queryFn: api.billing.entitlements,
    queryKey: ["billing", "entitlements"],
  });
  const activeCount =
    entitlements.data?.items.filter((item) => item.status === "active").length ?? 0;
  const billingAccessState = deriveBillingAccessState({
    activeCount,
    fetchStatus: entitlements.fetchStatus,
    isError: entitlements.isError,
    isPending: entitlements.isPending,
    verifiedAfterReturn,
  });
  const accessState =
    billingAccessState === "active"
      ? "active"
      : billingAccessState === "unknown"
        ? "error"
        : billingAccessState === "standard"
          ? "inactive"
          : "pending";

  const verifyAccess = useCallback(async () => {
    setVerifiedAfterReturn(false);
    await entitlements.refetch();
    setVerifiedAfterReturn(true);
  }, [entitlements.refetch]);

  useEffect(() => {
    void verifyAccess();
  }, [verifyAccess]);

  const StateIcon =
    accessState === "active" ? CheckCircle2 : accessState === "error" ? AlertCircle : Clock3;
  const iconColor =
    accessState === "active" ? "#237A55" : accessState === "error" ? "#B94242" : "#B86718";

  return (
    <Page contentContainerClassName="gap-7" width="reading">
      <View className="flex-row items-start gap-4">
        <StateIcon color={iconColor} size={32} strokeWidth={2.4} />
        <View className="min-w-0 flex-1 gap-2">
          <Text className="text-xs font-extrabold uppercase tracking-[1.6px] text-positive dark:text-[#8DDEAF]">
            {t("billing.returnEyebrow")}
          </Text>
          <Text
            accessibilityRole="header"
            className="text-[30px] font-black leading-[36px] tracking-[-1px] text-ink dark:text-white"
          >
            {t(`billing.returnTitle.${accessState}`)}
          </Text>
          <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
            {t(`billing.returnDescription.${accessState}`)}
          </Text>
          {checkoutId ? (
            <Text className="text-xs text-ink-muted dark:text-[#91A198]">
              {t("billing.returnReference")}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="gap-3 border-y border-line py-6 dark:border-[#304239] sm:flex-row">
        <Button
          label={t("billing.back")}
          onPress={() => router.replace("/billing")}
          variant="secondary"
        />
        {accessState !== "active" ? (
          <Button
            loading={entitlements.isFetching}
            onPress={() => void verifyAccess()}
            variant="primary"
          >
            <RefreshCw color="#FFFFFF" size={16} />
            <Text className="text-[15px] font-bold text-white">{t("billing.refresh")}</Text>
          </Button>
        ) : null}
      </View>
    </Page>
  );
}
