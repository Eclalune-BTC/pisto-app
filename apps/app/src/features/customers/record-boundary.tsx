import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

import { customersReceivablesCopy as copy } from "./copy";

export type RecordBoundaryState = "denied" | "error" | "loading" | "notFound" | "offline" | "ready";

type RecordBoundaryProps = {
  children: ReactNode;
  onBack: () => void;
  onRetry: () => void;
  state: RecordBoundaryState;
};

export function RecordBoundary({ children, onBack, onRetry, state }: RecordBoundaryProps) {
  if (state === "ready") return children;
  if (state === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.common.loading}</Text>
      </View>
    );
  }
  const content =
    state === "denied"
      ? { title: copy.access.deniedTitle, description: copy.access.deniedDescription }
      : state === "offline"
        ? { title: copy.access.offlineTitle, description: copy.access.offlineDescription }
        : state === "notFound"
          ? {
              title: copy.common.unavailableTitle,
              description: copy.common.unavailableDescription,
            }
          : {
              title: copy.common.unavailableTitle,
              description: copy.common.unavailableDescription,
            };
  return (
    <Page width="form">
      <Button label={copy.common.back} onPress={onBack} variant="ghost" />
      <View className="gap-3 border-y border-line py-7 dark:border-[#304239]">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {content.title}
        </Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {content.description}
        </Text>
        {state === "error" ? (
          <Button label={copy.common.retry} onPress={onRetry} variant="secondary" />
        ) : null}
      </View>
    </Page>
  );
}
