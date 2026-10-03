import { AlertTriangle, Info, WifiOff } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

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
  const foregroundColor = useCSSVariable("--color-foreground") as string;
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  const { t } = useTranslation();
  const copy = useMemo(() => catalogRemoteCopy(t), [t]);
  if (kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator color={foregroundColor} size="large" />
        <Text className="text-sm font-ui text-muted-foreground">{copy.loadingBusiness}</Text>
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
        <Icon color={kind === "offline" ? mutedColor : destructiveColor} size={24} />
        <View className="gap-2">
          <Text accessibilityRole="header" className="text-2xl font-heading text-foreground">
            {title}
          </Text>
          <Text className="max-w-[520px] text-sm leading-5 text-muted-foreground">
            {description}
          </Text>
        </View>
        <View className="gap-3 sm:flex-row">
          {kind === "error" && onRetry ? (
            <Button label={copy.retry} onPress={onRetry} variant="outline" />
          ) : null}
          {back ? <Button label={back.label} onPress={back.onPress} variant="outline" /> : null}
        </View>
      </View>
    </Page>
  );
}

export function ReadOnlyNotice({ description }: { description: string }) {
  const foregroundColor = useCSSVariable("--color-foreground") as string;
  const { t } = useTranslation();
  return (
    <View className="flex-row items-start gap-3 border-l-4 border-positive bg-positive-surface p-4">
      <Info color={foregroundColor} size={19} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-ui text-foreground">{t("catalog.remote.readOnlyTitle")}</Text>
        <Text className="text-sm leading-5 text-muted-foreground">{description}</Text>
      </View>
    </View>
  );
}
