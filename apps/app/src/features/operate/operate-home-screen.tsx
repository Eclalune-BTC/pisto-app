import { useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "expo-router";
import { ChevronRight, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { getVisibleOperateModules, OPERATE_GROUPS } from "@/features/operate/navigation";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import { operateModuleIcons } from "./module-icons";

export default function OperateHomeScreen() {
  const { t } = useTranslation();
  const businesses = useQuery(businessesQueryOptions);
  const activeBusiness = getActiveBusiness(businesses.data);

  if (hasDeniedRead([businesses])) return <CapabilityRouteState kind="denied" />;

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator size="large" />
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
                <Icon as={Plus} size={18} />
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

      <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2">
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
        <View className="flex-row flex-wrap gap-5">
          {OPERATE_GROUPS.map((group) => {
            const groupModules = modules.filter((module) => module.group === group.id);
            if (groupModules.length === 0) return null;

            return (
              <View
                className="w-full min-w-0 gap-3 rounded-card border border-border bg-card p-5 md:w-[48%] md:grow"
                key={group.id}
              >
                <Heading level={2} size="section">
                  {t(group.labelKey)}
                </Heading>
                <View>
                  {groupModules.map((module, index) => {
                    return (
                      <Link href={module.href} asChild key={module.id}>
                        <Button
                          accessibilityRole="link"
                          variant="ghost"
                          className={cn(
                            "h-auto min-h-20 w-full flex-row items-center justify-start gap-3 rounded-lg px-2 py-4",
                            index > 0 && "border-t border-border",
                          )}
                        >
                          <Icon
                            as={operateModuleIcons[module.id]}
                            className="text-primary"
                            size={21}
                          />
                          <View className="min-w-0 flex-1 gap-1">
                            <Text className="text-left text-base font-ui text-foreground">
                              {t(module.labelKey)}
                            </Text>
                            <Text className="text-left text-sm leading-5 text-muted-foreground">
                              {t(module.descriptionKey)}
                            </Text>
                          </View>
                          <Icon as={ChevronRight} className="text-muted-foreground" size={18} />
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
