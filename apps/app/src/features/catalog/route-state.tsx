import { AlertTriangle, Info, WifiOff } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

import { catalogRemoteCopy } from "./copy";

export type CapabilityRouteStateKind =
  | "denied"
  | "error"
  | "loading"
  | "notFound"
  | "offline"
  | "unavailable";

export function CapabilityRouteState({
  back,
  kind,
  onRetry,
}: {
  back?: { label: string; onPress: () => void };
  kind: CapabilityRouteStateKind;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const copy = useMemo(() => catalogRemoteCopy(t), [t]);
  if (kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {copy.loadingBusiness}
        </Text>
      </View>
    );
  }

  const title =
    kind === "denied"
      ? copy.deniedTitle
      : kind === "notFound"
        ? copy.notFoundTitle
        : kind === "offline"
          ? copy.offlineTitle
          : kind === "unavailable"
            ? copy.actionUnavailableTitle
            : copy.unavailableTitle;
  const description =
    kind === "denied"
      ? copy.deniedDescription
      : kind === "notFound"
        ? copy.notFoundDescription
        : kind === "offline"
          ? copy.offlineDescription
          : kind === "unavailable"
            ? copy.actionUnavailableDescription
            : copy.unavailableDescription;
  const Icon = kind === "offline" ? WifiOff : AlertTriangle;

  return (
    <Page width="reading">
      <View className="min-h-64 items-start justify-center gap-4">
        <Icon color={kind === "offline" ? "#617168" : "#B94242"} size={24} />
        <View className="gap-2">
          <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
            {title}
          </Text>
          <Text className="max-w-[520px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {description}
          </Text>
        </View>
        <View className="gap-3 sm:flex-row">
          {kind === "error" && onRetry ? (
            <Button label={copy.retry} onPress={onRetry} variant="secondary" />
          ) : null}
          {back ? <Button label={back.label} onPress={back.onPress} variant="secondary" /> : null}
        </View>
      </View>
    </Page>
  );
}

export function ReadOnlyNotice({ description }: { description: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-start gap-3 border-l-4 border-positive bg-[#EAF5ED] p-4 dark:bg-[#18352A]">
      <Info color="#237A55" size={19} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-bold text-ink dark:text-white">
          {t("catalog.remote.readOnlyTitle")}
        </Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">{description}</Text>
      </View>
    </View>
  );
}
