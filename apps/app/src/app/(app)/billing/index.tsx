import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ExternalLink } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { deriveBillingAccessState } from "@/lib/billing/billing-access";
import { platformBilling } from "@/lib/billing/platform-billing";

export default function BillingScreen() {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<string>();
  const catalog = useQuery({
    queryFn: api.billing.catalog,
    queryKey: ["billing", "catalog"],
  });
  const entitlements = useQuery({
    queryFn: api.billing.entitlements,
    queryKey: ["billing", "entitlements"],
  });
  const product = catalog.data?.products[0];
  const activeEntitlements =
    entitlements.data?.items.filter((item) => item.status === "active") ?? [];
  const billingChannel = platformBilling.capabilities.channel;
  const webCheckout = billingChannel === "web-checkout";
  const nativeBilling = billingChannel === "native-store-placeholder";

  const purchase = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No billing product is currently available.");
      return platformBilling.purchase(product.slug);
    },
    onError: () => setNotice(t("billing.purchaseError")),
    onSuccess: (result) => {
      if (result.status === "unavailable") setNotice(t("billing.purchaseUnavailable"));
    },
  });

  const manage = useMutation({
    mutationFn: platformBilling.manage,
    onError: () => setNotice(t("billing.manageError")),
    onSuccess: (result) => {
      if (result.status === "unavailable") setNotice(t("billing.manageUnavailableNotice"));
    },
  });

  const catalogEnabled = catalog.data?.status === "enabled";
  const canPurchase =
    platformBilling.capabilities.canPurchase && catalogEnabled && Boolean(product);
  const accessState = deriveBillingAccessState({
    activeCount: activeEntitlements.length,
    fetchStatus: entitlements.fetchStatus,
    isError: entitlements.isError,
    isPending: entitlements.isPending,
  });
  const accessLabelKeys = {
    active: "billing.stateActive",
    checking: "billing.stateChecking",
    standard: "billing.stateStandard",
    unknown: "billing.stateUnknown",
  } as const;
  const accessLabel = t(accessLabelKeys[accessState]);

  return (
    <Page>
      <ScreenHeader
        description={t("billing.description")}
        eyebrow={t("billing.eyebrow")}
        title={t("billing.title")}
      />

      {notice ? (
        <View className="flex-row items-start gap-3 border-l-4 border-warning bg-[#FFF8EC] p-4 dark:bg-[#392B1C]">
          <AlertCircle color="#B86718" size={20} />
          <Text
            accessibilityRole="alert"
            className="min-w-0 flex-1 text-sm font-semibold leading-5 text-warning dark:text-[#F6BB76]"
          >
            {notice}
          </Text>
        </View>
      ) : null}

      <View className="gap-10 lg:flex-row lg:items-start lg:gap-12">
        <View className="border-y border-line dark:border-[#304239] lg:w-[40%]">
          <View className="gap-5 py-7 sm:flex-row sm:items-start sm:justify-between lg:flex-col">
            <View className="min-w-0 flex-1 gap-2">
              <Text className="text-2xl font-black text-ink dark:text-white">
                {t("billing.accessTitle")}
              </Text>
              <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {accessState === "checking"
                  ? t("billing.accessChecking")
                  : accessState === "unknown"
                    ? t("billing.accessError")
                    : accessState === "active"
                      ? t("billing.accessCount", { count: activeEntitlements.length })
                      : t("billing.accessStandard")}
              </Text>
            </View>
            <Text className="text-sm font-extrabold uppercase tracking-[1.2px] text-positive dark:text-[#8DDEAF]">
              {accessLabel}
            </Text>
          </View>

          {accessState === "active" ? (
            <View className="flex-row items-center justify-between border-t border-line py-4 dark:border-[#304239]">
              <Text className="font-bold text-ink dark:text-white">
                {t("billing.activeAccess")}
              </Text>
              <Text className="text-sm font-bold text-positive dark:text-[#8DDEAF]">
                {t("billing.stateActive")}
              </Text>
            </View>
          ) : null}

          <View className="border-t border-line py-5 dark:border-[#304239]">
            {accessState === "unknown" ? (
              <Button
                className="self-start"
                label={t("billing.retryAccess")}
                loading={entitlements.isFetching}
                onPress={() => entitlements.refetch()}
                variant="secondary"
              />
            ) : (
              <Button
                className="self-start"
                disabled={!platformBilling.capabilities.canManage}
                label={webCheckout ? t("billing.manage") : t("billing.manageUnavailable")}
                loading={manage.isPending}
                onPress={() => manage.mutate()}
                variant="secondary"
              />
            )}
          </View>
        </View>

        <View className="min-w-0 flex-1 gap-8">
          <View className="gap-6 border-b border-line pb-8 dark:border-[#304239]">
            <View className="gap-2 border-l-4 border-accent pl-5">
              <Text className="text-sm font-bold text-positive dark:text-[#8DDEAF]">
                {webCheckout
                  ? t("billing.webSubscription")
                  : nativeBilling
                    ? t("billing.nativeAccess")
                    : t("billing.unavailable")}
              </Text>
              <Text className="text-[30px] font-black leading-[36px] tracking-[-1px] text-ink dark:text-white">
                {catalog.isPending
                  ? t("billing.loadingPlan")
                  : catalog.isError
                    ? t("billing.planUnavailable")
                    : product?.name
                      ? product.name
                      : catalogEnabled
                        ? t("billing.noPlan")
                        : t("billing.notConfigured")}
              </Text>
              {catalog.isError ? (
                <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
                  {t("billing.catalogError")}
                </Text>
              ) : product?.description ? (
                <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
                  {product.description}
                </Text>
              ) : !catalog.isPending ? (
                <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
                  {catalogEnabled ? t("billing.noPurchasablePlan") : t("billing.checkoutDisabled")}
                </Text>
              ) : null}
            </View>

            {webCheckout ? (
              <View className="gap-3">
                {catalog.isError ? (
                  <Button
                    className="self-start"
                    label={t("billing.retryPlan")}
                    loading={catalog.isFetching}
                    onPress={() => catalog.refetch()}
                    variant="secondary"
                  />
                ) : canPurchase ? (
                  <Button
                    className="self-start"
                    loading={purchase.isPending}
                    onPress={() => purchase.mutate()}
                    variant="accent"
                  >
                    <ButtonText variant="accent">{t("billing.continueCheckout")}</ButtonText>
                    <ExternalLink color="#14241D" size={16} strokeWidth={2.4} />
                  </Button>
                ) : (
                  <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                    {t("billing.noCheckoutAction")}
                  </Text>
                )}
                <Text className="text-xs leading-5 text-ink-muted dark:text-[#91A198]">
                  {t("billing.checkoutSecurity")}
                </Text>
              </View>
            ) : nativeBilling ? (
              <View className="gap-2">
                <Text className="font-bold text-ink dark:text-white">
                  {t("billing.nativeDisabledTitle")}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                  {t("billing.nativeDisabledDescription")}
                </Text>
              </View>
            ) : (
              <View className="gap-2">
                <Text className="font-bold text-ink dark:text-white">
                  {t("billing.unresolvedTitle")}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                  {t("billing.unresolvedDescription")}
                </Text>
              </View>
            )}
          </View>

          <View className="gap-2">
            <Text className="font-bold text-ink dark:text-white">{t("billing.howTitle")}</Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {t("billing.howDescription")}
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}
