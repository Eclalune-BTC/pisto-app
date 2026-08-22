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
      <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">{label}</Text>
      <View
        className={cn(
          "min-h-14 flex-row items-center rounded-lg border bg-white px-4 dark:bg-[#14241D]",
          error ? "border-danger" : "border-line dark:border-[#3B4A43]",
        )}
      >
        <TextInput
          accessibilityHint={error ?? accessibilityHint}
          accessibilityLabel={accessibilityLabel ?? label}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          className={cn("min-w-0 flex-1 text-base text-ink dark:text-white", className)}
          placeholderTextColor="#7B8A82"
          {...props}
        />
        {trailing}
      </View>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="text-xs text-danger"
          nativeID={errorId}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
