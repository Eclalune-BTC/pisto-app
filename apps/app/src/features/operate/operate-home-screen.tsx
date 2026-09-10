import { useQuery } from "@tanstack/react-query";
import { Link, Redirect, useRouter } from "expo-router";
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
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { hasDeniedRead } from "@/features/customers/remote-state";
import {
  getVisibleOperateModules,
  OPERATE_GROUPS,
  type OperateModuleId,
} from "@/features/operate/navigation";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

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
  const { t } = useTranslation();
  const router = useRouter();
  const businesses = useQuery(businessesQueryOptions);
  const activeBusiness = getActiveBusiness(businesses.data);

  if (hasDeniedRead([businesses])) return <CapabilityRouteState kind="denied" />;

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
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
        <Button
          label={t("common.retry")}
          onPress={() => businesses.refetch()}
          variant="secondary"
        />
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
            <Button onPress={() => router.push("/operate/sales/new")} variant="accent">
              <Plus color="#14241D" size={18} strokeWidth={2.6} />
              <ButtonText variant="accent">{t("sales.register")}</ButtonText>
            </Button>
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
          <Text className="text-sm font-semibold text-foreground">{activeBusiness.currency}</Text>
        </View>
        <View className="flex-row items-baseline gap-2">
          <Text className="text-sm text-muted-foreground">{t("common.timeZone")}</Text>
          <Text className="text-sm font-semibold text-foreground">{activeBusiness.timeZone}</Text>
        </View>
      </View>

      {modules.length === 0 ? (
        <View className="max-w-[560px] gap-2 border-l-4 border-warning bg-[#FFF6E8] p-5 dark:bg-[#3A2A18]">
          <Heading level={2} size="section">
            {t("operate.noAccessTitle")}
          </Heading>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
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
                        <Pressable
                          className={cn(
                            "min-h-16 flex-row items-center gap-3 px-1 py-3 active:bg-muted",
                            index > 0 && "border-t border-border",
                          )}
                        >
                          <Icon color="#237A55" size={20} strokeWidth={2} />
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-base font-semibold text-foreground">
                              {t(module.labelKey)}
                            </Text>
                            <Text className="text-sm leading-5 text-muted-foreground">
                              {t(module.descriptionKey)}
                            </Text>
                          </View>
                          <ChevronRight color="#7E8D84" size={20} />
                        </Pressable>
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
