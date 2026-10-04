import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type CorrectionMode = "void" | "replacement";

const FIELD_ID = "sale-correction-mode";

/**
 * The two corrections a posted sale allows, each with the consequence it has. The section heading
 * above it names the choice, so the group only carries an accessible name.
 */
export function CorrectionModeField({
  onChange,
  value,
}: {
  onChange: (mode: CorrectionMode) => void;
  value: CorrectionMode;
}) {
  const { t } = useTranslation();
  const options: { description: string; label: string; value: CorrectionMode }[] = [
    {
      description: t("sales.correction.voidDescription"),
      label: t("sales.correction.void"),
      value: "void",
    },
    {
      description: t("sales.correction.replaceDescription"),
      label: t("sales.correction.replace"),
      value: "replacement",
    },
  ];
  const select = (next: string) => {
    const option = options.find((candidate) => candidate.value === next);
    if (!option) throw new Error("The selected correction is not one of the offered modes.");
    onChange(option.value);
  };
  return (
    <RadioGroup
      aria-label={t("sales.correction.mode")}
      className="gap-0 overflow-hidden rounded-lg border border-border bg-card"
      onValueChange={select}
      value={value}
    >
      {options.map((option, index) => (
        <View
          className={cn(
            "min-w-0 flex-row items-start gap-3 px-3 py-2.5",
            index > 0 && "border-t border-border",
          )}
          key={option.value}
        >
          <RadioGroupItem
            aria-describedby={`${FIELD_ID}-${option.value}-description`}
            aria-labelledby={`${FIELD_ID}-${option.value}-label`}
            className="mt-0.5"
            hitSlop={12}
            nativeID={`${FIELD_ID}-${option.value}`}
            value={option.value}
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Label
              nativeID={`${FIELD_ID}-${option.value}-label`}
              onPress={() => select(option.value)}
            >
              {option.label}
            </Label>
            <Text
              className="text-[13px] leading-5 text-muted-foreground"
              nativeID={`${FIELD_ID}-${option.value}-description`}
            >
              {option.description}
            </Text>
          </View>
        </View>
      ))}
    </RadioGroup>
  );
}
