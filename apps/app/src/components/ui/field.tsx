import { type ComponentProps, type ReactNode, useId } from "react";
import { Text, TextInput, View } from "react-native";

import { cn } from "@/lib/cn";

type FieldProps = ComponentProps<typeof TextInput> & {
  error?: string;
  label: string;
  trailing?: ReactNode;
};

export function Field({
  accessibilityHint,
  accessibilityLabel,
  className,
  error,
  label,
  trailing,
  ...props
}: FieldProps) {
  const errorId = useId();

  return (
    <View className="gap-2">
      <Text className="web:font-sans text-sm font-medium text-foreground">{label}</Text>
      <View
        className={cn(
          "min-h-12 flex-row items-center rounded-lg border bg-input px-3",
          error ? "border-destructive" : "border-input-border",
        )}
      >
        <TextInput
          accessibilityHint={error ?? accessibilityHint}
          accessibilityLabel={accessibilityLabel ?? label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          className={cn(
            "web:font-sans min-h-12 min-w-0 flex-1 py-3 text-base text-foreground",
            className,
          )}
          placeholderTextColor="#7B8A82"
          {...props}
        />
        {trailing}
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="text-xs text-destructive"
          nativeID={errorId}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
