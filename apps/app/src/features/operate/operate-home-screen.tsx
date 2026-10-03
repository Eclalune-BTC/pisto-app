import { useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "expo-router";
import {
  Boxes,
  ChartColumn,
  ChevronRight,
  CircleDollarSign,
  ContactRound,
  HandCoins,
  PackageSearch,
  Plus,
  ReceiptText,
  WalletCards,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import {
  getVisibleOperateModules,
  OPERATE_GROUPS,
  type OperateModuleId,
} from "@/features/operate/navigation";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";

type OperateIcon = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

const moduleIcons: Record<OperateModuleId, OperateIcon> = {
  sales: ReceiptText,
  expenses: CircleDollarSign,
  cash: WalletCards,
  catalog: PackageSearch,
  inventory: Boxes,
  customers: ContactRound,
  receivables: HandCoins,
  reports: ChartColumn,
};

export default function OperateHomeScreen() {
  const foregroundColor = useCSSVariable("--color-foreground") as string;
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const primaryForegroundColor = useCSSVariable("--color-primary-foreground") as string;
  const { t } = useTranslation();
  const businesses = useQuery(businessesQueryOptions);
  const activeBusiness = getActiveBusiness(businesses.data);

  if (hasDeniedRead([businesses])) return <CapabilityRouteState kind="denied" />;

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator color={foregroundColor} size="large" />
        <Text className="text-sm text-muted-foreground">{t("operate.loading")}</Text>
      </View>
    );
  }

  if (businesses.isError && !businesses.data) {
    return (
      <View className="flex-1 items-start justify-center gap-4 px-5 sm:px-8 lg:px-10">
        <View className="max-w-[460px] gap-2">
          <Heading size="section">{t("operate.unavailableTitle")}</Heading>
          <Text className="text-sm leading-5 text-muted-foreground">
            {t("operate.unavailableDescription")}
          </Text>
        </View>
        <Button label={t("common.retry")} onPress={() => businesses.refetch()} variant="outline" />
      </View>
    );
  }

  if (!activeBusiness) return <Redirect href="/business" />;

  const modules = getVisibleOperateModules(activeBusiness.access.permissions);
  const canCreateSale = activeBusiness.access.permissions.includes("sales:create");

  return (
    <Page>
      <ScreenHeader
        action={
          canCreateSale ? (
            <Link href="/operate/sales/new" asChild>
              <Button accessibilityRole="link" variant="default">
                <Plus color={primaryForegroundColor} size={18} strokeWidth={2.6} />
                <Text>{t("sales.register")}</Text>
              </Button>
            </Link>
          ) : undefined
        }
        description={t("operate.description")}
        eyebrow={t("common.operate")}
        title={activeBusiness.name}
      />

      {businesses.isError && businesses.data ? <StaleNotice /> : null}

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-sm text-muted-foreground">{t("common.currency")}</Text>
          <Text className="text-sm font-ui text-foreground">{activeBusiness.currency}</Text>
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text className="text-sm text-muted-foreground">{t("common.timeZone")}</Text>
          <Text className="text-sm font-ui text-foreground">{activeBusiness.timeZone}</Text>
        </View>
      </View>

      {modules.length === 0 ? (
        <View className="max-w-[560px] gap-2 border-l-4 border-warning bg-warning-surface p-5 ">
          <Heading level={2} size="section">
            {t("operate.noAccessTitle")}
          </Heading>
          <Text className="text-sm leading-5 text-muted-foreground ">
            {t("operate.noAccessDescription")}
          </Text>
        </View>
      ) : (
        <View className="gap-7">
          {OPERATE_GROUPS.map((group) => {
            const groupModules = modules.filter((module) => module.group === group.id);
            if (groupModules.length === 0) return null;

            return (
              <View className="gap-3" key={group.id}>
                <Heading level={2} size="section">
                  {t(group.labelKey)}
                </Heading>
                <View className="border-y border-border">
                  {groupModules.map((module, index) => {
                    const Icon = moduleIcons[module.id];
                    return (
                      <Link href={module.href} asChild key={module.id}>
                        <Button
                          accessibilityRole="link"
                          variant="ghost"
                          className={cn(
                            "h-auto min-h-16 w-full flex-row items-center justify-start gap-3 rounded-none px-1 py-3",
                            index > 0 && "border-t border-border",
                          )}
                        >
                          <Icon color={foregroundColor} size={20} strokeWidth={2} />
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-left text-base font-ui text-foreground">
                              {t(module.labelKey)}
                            </Text>
                            <Text className="text-left text-sm leading-5 text-muted-foreground">
                              {t(module.descriptionKey)}
                            </Text>
                          </View>
                          <ChevronRight color={mutedColor} size={20} />
                        </Button>
                      </Link>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Page>
  );
}
