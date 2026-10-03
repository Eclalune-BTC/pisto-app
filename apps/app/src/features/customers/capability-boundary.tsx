import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

import { buildCustomersCopy } from "./copy";

export type CapabilityBoundaryState = "denied" | "error" | "loading" | "offline" | "ready";

type CapabilityBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
  state: CapabilityBoundaryState;
};

export function CapabilityBoundary({ children, onRetry, state }: CapabilityBoundaryProps) {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  if (state === "ready") return children;
  const content =
    state === "offline"
      ? { title: copy.access.offlineTitle, description: copy.access.offlineDescription }
      : state === "denied"
        ? { title: copy.access.deniedTitle, description: copy.access.deniedDescription }
        : {
            title: copy.common.unavailableTitle,
            description: copy.common.unavailableDescription,
          };
  if (state === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator color="#237A55" size="large" />
        <Text className="text-sm font-ui text-muted-foreground">{copy.common.loading}</Text>
      </View>
    );
  }
  return (
    <Page>
      <View className="min-h-56 items-start justify-center gap-3 border-y border-border py-8 ">
        <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
          {content.title}
        </Text>
        <Text className="max-w-[560px] text-sm leading-5 text-muted-foreground">
          {content.description}
        </Text>
        {state === "error" ? (
          <Button label={copy.common.retry} onPress={onRetry} variant="outline" />
        ) : null}
      </View>
    </Page>
  );
}
