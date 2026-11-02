import { ChevronsUpDown } from "lucide-react-native";
import type { Ref } from "react";
import { View } from "react-native";

import { FieldLabel } from "@/components/ui/field-label";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type PickerFieldProps = {
  detail?: string;
  error?: string;
  label: string;
  /** The transcript number of the fragment that filled this field, during an assistant review. */
  marker?: number | null;
  onPress: () => void;
  placeholder: string;
  /** The control itself, so the picker it opens can return focus to it. */
  ref?: Ref<View>;
  value?: string;
};

/** A form control whose value is chosen in a picker dialog instead of being typed. */
export function PickerField({
  detail,
  error,
  label,
  marker,
  onPress,
  placeholder,
  ref,
  value,
}: PickerFieldProps) {
  return (
    <View className="min-w-0 gap-2">
      <FieldLabel marker={marker}>
        <Text className="font-ui text-sm leading-none text-foreground">{label}</Text>
      </FieldLabel>
      <PressableSurface
        accessibilityHint={error}
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityRole="button"
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-9 flex-row items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 native:min-h-11",
          error ? "border-destructive" : "border-input",
        )}
        onPress={onPress}
        ref={ref}
      >
        <View className="min-w-0 flex-1">
          <Text
            className={cn("text-sm leading-5", value ? "text-foreground" : "text-muted-foreground")}
            numberOfLines={1}
          >
            {value ?? placeholder}
          </Text>
          {value && detail ? (
            <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Icon as={ChevronsUpDown} className="text-muted-foreground" size={14} />
      </PressableSurface>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
