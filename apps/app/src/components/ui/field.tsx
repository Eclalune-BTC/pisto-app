import type { ComponentProps, ReactNode } from "react";
import { Text, TextInput, View } from "react-native";

import { cn } from "@/lib/cn";

type FieldProps = ComponentProps<typeof TextInput> & {
  error?: string;
  label: string;
  trailing?: ReactNode;
};

export function Field({ className, error, label, trailing, ...props }: FieldProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">{label}</Text>
      <View
        className={cn(
          "min-h-14 flex-row items-center rounded-2xl border bg-white px-4 dark:bg-[#14241D]",
          error ? "border-danger" : "border-line dark:border-[#3B4A43]",
        )}
      >
        <TextInput
          className={cn(
            "min-w-0 flex-1 text-base text-ink outline-none dark:text-white",
            className,
          )}
          placeholderTextColorClassName="text-[#8B9991] dark:text-[#87958D]"
          {...props}
        />
        {trailing}
      </View>
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
