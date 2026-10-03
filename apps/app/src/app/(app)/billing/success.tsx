import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
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
          <Text className="text-xs font-ui uppercase tracking-[1.6px] text-positive-foreground ">
            {t("billing.returnEyebrow")}
          </Text>
          <Text
            accessibilityRole="header"
            className="text-[30px] font-heading leading-[36px] tracking-[-1px] text-foreground"
          >
            {t(`billing.returnTitle.${accessState}`)}
          </Text>
          <Text className="text-base leading-6 text-muted-foreground">
            {t(`billing.returnDescription.${accessState}`)}
          </Text>
          {checkoutId ? (
            <Text className="text-xs text-muted-foreground ">{t("billing.returnReference")}</Text>
          ) : null}
        </View>
      </View>

      <View className="gap-3 border-y border-border py-6  sm:flex-row">
        <Button
          label={t("billing.back")}
          onPress={() => router.replace("/billing")}
          variant="outline"
        />
        {accessState !== "active" ? (
          <Button
            label={t("billing.refresh")}
            loading={entitlements.isFetching}
            onPress={() => void verifyAccess()}
            variant="default"
          />
        ) : null}
      </View>
    </Page>
  );
}
