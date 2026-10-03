import { type ComponentProps, type ReactNode, useId } from "react";
import { View } from "react-native";
import { cn } from "@/lib/cn";
import { Input } from "./input";
import { Label } from "./label";
import { Text } from "./text";
import { Textarea } from "./textarea";

type FieldProps = ComponentProps<typeof Input> & {
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
  nativeID,
  multiline,
  ...props
}: FieldProps) {
  const id = useId();
  const inputId = nativeID ?? id;
  const InputComponent = multiline ? Textarea : Input;
  return (
    <View className="min-w-0 gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <View className="relative min-w-0">
        <InputComponent
          {...props}
          nativeID={inputId}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? accessibilityHint}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-destructive", trailing && "pr-16", className)}
        />
        {trailing ? (
          <View className="absolute inset-y-0 right-3 justify-center">{trailing}</View>
        ) : null}
      </View>
      {error ? (
        <Text
          nativeID={`${id}-error`}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="text-sm text-destructive"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
