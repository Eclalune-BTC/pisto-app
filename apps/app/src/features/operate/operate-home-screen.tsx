import { useQuery } from "@tanstack/react-query";
import { Link, Redirect, useRouter } from "expo-router";
import {
  Boxes,
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
};

export default function OperateHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const businesses = useQuery(businessesQueryOptions);
  const activeBusiness = getActiveBusiness(businesses.data);

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {t("operate.loading")}
        </Text>
      </View>
    );
  }

  if (businesses.isError && !businesses.data) {
    return (
      <View className="flex-1 items-start justify-center gap-4 px-5 sm:px-8 lg:px-10">
        <View className="max-w-[460px] gap-2">
          <Text className="text-xl font-black text-ink dark:text-white">
            {t("operate.unavailableTitle")}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
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
    <Page contentContainerClassName="gap-9">
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

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-4 dark:border-[#304239]">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
            {t("common.currency")}
          </Text>
          <Text className="font-black text-ink dark:text-white">{activeBusiness.currency}</Text>
        </View>
        <View className="h-4 w-px bg-line dark:bg-[#304239]" />
        <View className="flex-row items-baseline gap-2">
          <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
            {t("common.timeZone")}
          </Text>
          <Text className="font-semibold text-ink dark:text-white">{activeBusiness.timeZone}</Text>
        </View>
      </View>

      {modules.length === 0 ? (
        <View className="max-w-[560px] gap-2 border-l-4 border-warning bg-[#FFF6E8] p-5 dark:bg-[#3A2A18]">
          <Text className="font-black text-ink dark:text-white">{t("operate.noAccessTitle")}</Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
            {t("operate.noAccessDescription")}
          </Text>
        </View>
      ) : (
        <View className="gap-9">
          {OPERATE_GROUPS.map((group) => {
            const groupModules = modules.filter((module) => module.group === group.id);
            if (groupModules.length === 0) return null;

            return (
              <View className="gap-3" key={group.id}>
                <Text className="text-xs font-black uppercase tracking-[1.2px] text-ink-muted dark:text-[#91A198]">
                  {t(group.labelKey)}
                </Text>
                <View className="border-y border-line dark:border-[#304239]">
                  {groupModules.map((module, index) => {
                    const Icon = moduleIcons[module.id];
                    return (
                      <Link href={module.href} asChild key={module.id}>
                        <Pressable
                          className={cn(
                            "min-h-20 flex-row items-center gap-4 px-1 py-4 active:bg-[#EFF3EF] dark:active:bg-[#21352C]",
                            index > 0 && "border-t border-line dark:border-[#304239]",
                          )}
                        >
                          <View className="h-10 w-10 items-center justify-center rounded-full bg-[#EAF0EB] dark:bg-[#23372E]">
                            <Icon color="#237A55" size={20} strokeWidth={2.2} />
                          </View>
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-base font-black text-ink dark:text-white">
                              {t(module.labelKey)}
                            </Text>
                            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
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
