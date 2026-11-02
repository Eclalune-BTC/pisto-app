import { type ComponentProps, type ReactNode, useId } from "react";
import { View } from "react-native";
import { cn } from "@/lib/cn";
import { FieldLabel } from "./field-label";
import { Input } from "./input";
import { Label } from "./label";
import { Text } from "./text";
import { Textarea } from "./textarea";

type FieldProps = ComponentProps<typeof Input> & {
  /** Persistent hint under the control; described together with any error. */
  description?: string;
  error?: string;
  label: string;
  /** The transcript number of the fragment that filled this field, during an assistant review. */
  marker?: number | null;
  trailing?: ReactNode;
};

export function Field({
  accessibilityHint,
  accessibilityLabel,
  className,
  description,
  error,
  label,
  marker,
  trailing,
  nativeID,
  multiline,
  ...props
}: FieldProps) {
  const id = useId();
  const inputId = nativeID ?? id;
  const InputComponent = multiline ? Textarea : Input;
  const hint = error ? undefined : description;
  const describedBy = error ? `${id}-error` : hint ? `${id}-description` : undefined;
  return (
    <View className="min-w-0 gap-1.5">
      <FieldLabel marker={marker}>
        <Label className="text-[13px]" htmlFor={inputId}>
          {label}
        </Label>
      </FieldLabel>
      <View className="relative min-w-0">
        <InputComponent
          {...props}
          nativeID={inputId}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ?? hint ?? accessibilityHint}
          aria-describedby={describedBy}
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
      {hint ? (
        <Text nativeID={`${id}-description`} className="text-xs leading-4 text-muted-foreground">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
