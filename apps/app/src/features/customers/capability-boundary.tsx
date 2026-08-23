import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

import { customersReceivablesCopy as copy } from "./copy";

export type CapabilityBoundaryState = "denied" | "error" | "loading" | "offline" | "ready";

type CapabilityBoundaryProps = {
  children: ReactNode;
  onRetry: () => void;
  state: CapabilityBoundaryState;
};

export function CapabilityBoundary({ children, onRetry, state }: CapabilityBoundaryProps) {
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
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {copy.common.loading}
        </Text>
      </View>
    );
  }
  return (
    <Page>
      <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {content.title}
        </Text>
        <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {content.description}
        </Text>
        {state === "error" ? (
          <Button label={copy.common.retry} onPress={onRetry} variant="secondary" />
        ) : null}
      </View>
    </Page>
  );
}
