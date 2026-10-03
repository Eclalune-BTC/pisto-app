import type { ComponentProps } from "react";
import { ActivityIndicator } from "react-native";
import { useCSSVariable } from "uniwind";

export function LoadingIndicator({ color, ...props }: ComponentProps<typeof ActivityIndicator>) {
  const foreground = useCSSVariable("--color-foreground") as string;
  return <ActivityIndicator {...props} color={color ?? foreground} />;
}
