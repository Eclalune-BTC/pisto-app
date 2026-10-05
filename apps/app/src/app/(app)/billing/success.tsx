import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { deriveBillingAccessState } from "@/lib/billing/billing-access";

/**
 * Returning from checkout is not proof of payment: this screen reports only what a fresh read of
 * the entitlements says, checked once on entry and again on request.
 */
export default function BillingSuccessScreen() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [verifiedAfterReturn, setVerifiedAfterReturn] = useState(false);
  const entitlements = useQuery({
    enabled: false,
    queryFn: api.billing.entitlements,
    queryKey: ["billing", "entitlements"],
  });
  const activeCount =
    entitlements.data?.items.filter((item) => item.status === "active").length ?? 0;
  const access = deriveBillingAccessState({
    activeCount,
    fetchStatus: entitlements.fetchStatus,
    isError: entitlements.isError,
    isPending: entitlements.isPending,
    verifiedAfterReturn,
  });

  const verifyAccess = useCallback(async () => {
    setVerifiedAfterReturn(false);
    await entitlements.refetch();
    setVerifiedAfterReturn(true);
  }, [entitlements.refetch]);

  useEffect(() => {
    void verifyAccess();
  }, [verifyAccess]);

  const outcome =
    access === "active"
      ? "active"
      : access === "unknown"
        ? "error"
        : access === "standard"
          ? "inactive"
          : "pending";
  const checkedAt =
    verifiedAfterReturn && entitlements.dataUpdatedAt > 0
      ? formatLocalizedDateTime(new Date(entitlements.dataUpdatedAt), locale)
      : undefined;

  return (
    <Page width="reading">
      {/* The outcome changes in place after each check, so it is announced rather than focused. */}
      <View accessibilityLiveRegion="polite" className="gap-2">
        <PageHeader
          adornment={
            outcome === "active" ? (
              <StatusBadge label={t("billing.access.active")} tone="settled" />
            ) : outcome === "error" ? (
              <StatusBadge label={t("billing.return.unverified")} tone="attention" />
            ) : undefined
          }
          description={
            outcome === "active"
              ? t("billing.accessCount", { count: activeCount })
              : t(`billing.return.description.${outcome}`)
          }
          title={t(`billing.return.title.${outcome}`)}
        />
        {checkedAt && outcome !== "pending" ? (
          <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
            {t("billing.return.checkedAt", { date: checkedAt })}
          </Text>
        ) : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {outcome === "active" ? (
          <Link asChild href="/operate">
            <Button accessibilityRole="link">
              <Text>{t("billing.return.home")}</Text>
            </Button>
          </Link>
        ) : (
          // Not `loading`: a disabled button would drop keyboard focus while the check runs.
          <Button
            label={t("billing.return.refresh")}
            onPress={() => {
              if (!entitlements.isFetching) void verifyAccess();
            }}
          />
        )}
      </View>
    </Page>
  );
}
