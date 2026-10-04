import type { ReactNode } from "react";
import { View } from "react-native";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

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
  inline?: boolean;
};

export function FeatureBoundary({
  state,
  copy,
  children,
  onRetry,
  inline = false,
}: FeatureBoundaryProps) {
  const Container = inline ? View : Page;
  if (state.kind === "loading") {
    return (
      <View
        className={
          inline
            ? "min-h-48 items-start justify-center gap-3"
            : "flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10"
        }
      >
        <LoadingIndicator size="large" />
        <Text className="text-sm font-ui text-muted-foreground">{copy.loading}</Text>
      </View>
    );
  }
  if (state.kind === "denied") {
    return (
      <Container>
        <View className="min-h-56 items-start justify-center gap-3 border-y border-border py-8">
          <Text
            accessibilityRole="header"
            aria-level={inline ? 2 : 1}
            className="text-xl font-heading text-foreground"
          >
            {copy.deniedTitle}
          </Text>
          <Text className="font-sans max-w-[560px] text-sm leading-5 text-muted-foreground">
            {copy.deniedDescription}
          </Text>
        </View>
      </Container>
    );
  }
  if (state.kind === "offline" || state.kind === "error") {
    return (
      <Container>
        <View className="min-h-56 items-start justify-center gap-3 border-y border-border py-8">
          <Text
            accessibilityRole="header"
            aria-level={inline ? 2 : 1}
            className="text-xl font-heading text-foreground"
          >
            {state.kind === "offline" ? copy.offlineTitle : copy.unavailableTitle}
          </Text>
          <Text className="font-sans max-w-[560px] text-sm leading-5 text-muted-foreground">
            {state.message}
          </Text>
          <Button label={copy.retry} onPress={onRetry} variant="outline" />
        </View>
      </Container>
    );
  }
  return children;
}
