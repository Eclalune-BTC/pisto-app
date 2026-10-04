import { type ComponentProps, type ReactNode, useId } from "react";
import { View } from "react-native";
import { cn } from "@/lib/cn";
import { Input } from "./input";
import { Label } from "./label";
import { Text } from "./text";
import { Textarea } from "./textarea";

type FieldProps = ComponentProps<typeof Input> & {
  /** Persistent hint under the control; described together with any error. */
  description?: string;
  error?: string;
  label: string;
  trailing?: ReactNode;
};

export function Field({
  accessibilityHint,
  accessibilityLabel,
  className,
  description,
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
  const describedBy = [error ? `${id}-error` : null, description ? `${id}-description` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <View className="min-w-0 gap-1.5">
      <Label className="text-[13px]" htmlFor={inputId}>
        {label}
      </Label>
      <View className="relative min-w-0">
        <InputComponent
          {...props}
          nativeID={inputId}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? description ?? accessibilityHint}
          aria-describedby={describedBy || undefined}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-destructive", trailing && "pr-14", className)}
        />
        {trailing ? (
          <View className="absolute inset-y-0 right-2.5 justify-center">{trailing}</View>
        ) : null}
      </View>
      {error ? (
        <Text
          nativeID={`${id}-error`}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="text-[13px] leading-5 text-destructive"
        >
          {error}
        </Text>
      ) : null}
      {description ? (
        <Text nativeID={`${id}-description`} className="text-xs leading-4 text-muted-foreground">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
