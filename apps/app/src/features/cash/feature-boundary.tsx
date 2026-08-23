import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

export type FeatureRemoteState =
  | { kind: "loading" }
  | { kind: "offline"; message: string }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

export type FeatureBoundaryCopy = {
  loading: string;
  deniedTitle: string;
  deniedDescription: string;
  offlineTitle: string;
  unavailableTitle: string;
  retry: string;
};

export function requireFeatureManageAccess(
  state: FeatureRemoteState,
  canManage: boolean,
): FeatureRemoteState {
  return state.kind === "ready" && !canManage ? { kind: "denied" } : state;
}

type FeatureBoundaryProps = {
  state: FeatureRemoteState;
  copy: FeatureBoundaryCopy;
  children: ReactNode;
  onRetry: () => void;
};

export function FeatureBoundary({ state, copy, children, onRetry }: FeatureBoundaryProps) {
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {copy.loading}
        </Text>
      </View>
    );
  }
  if (state.kind === "denied") {
    return (
      <Page>
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {copy.deniedTitle}
          </Text>
          <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {copy.deniedDescription}
          </Text>
        </View>
      </Page>
    );
  }
  if (state.kind === "offline" || state.kind === "error") {
    return (
      <Page>
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {state.kind === "offline" ? copy.offlineTitle : copy.unavailableTitle}
          </Text>
          <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {state.message}
          </Text>
          <Button label={copy.retry} onPress={onRetry} variant="secondary" />
        </View>
      </Page>
    );
  }
  return children;
}
