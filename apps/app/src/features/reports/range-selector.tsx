import { CalendarDays } from "lucide-react-native";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import type { ReportRangeIssue } from "./date-range";

export type ReportRangeCopy = {
  apply: string;
  applying: string;
  datePlaceholder: string;
  description: string;
  endLabel: string;
  invalidEnd: string;
  invalidStart: string;
  reversed: string;
  startLabel: string;
  title: string;
  tooLong: string;
};

type ReportRangeSelectorProps = {
  applying: boolean;
  copy: ReportRangeCopy;
  endLocalDate: string;
  issue: ReportRangeIssue | null;
  onApply: () => void;
  onEndLocalDateChange: (value: string) => void;
  onStartLocalDateChange: (value: string) => void;
  startLocalDate: string;
};

function rangeErrors(
  copy: ReportRangeCopy,
  issue: ReportRangeIssue | null,
): { end?: string; start?: string } {
  switch (issue) {
    case "invalid-start":
      return { start: copy.invalidStart };
    case "invalid-end":
      return { end: copy.invalidEnd };
    case "reversed":
      return { end: copy.reversed };
    case "too-long":
      return { end: copy.tooLong };
    default:
      return {};
  }
}

export function ReportRangeSelector({
  applying,
  copy,
  endLocalDate,
  issue,
  onApply,
  onEndLocalDateChange,
  onStartLocalDateChange,
  startLocalDate,
}: ReportRangeSelectorProps) {
  const errors = rangeErrors(copy, issue);
  return (
    <View className="gap-5 border-y border-line py-5 dark:border-[#304239]">
      <View className="flex-row items-start gap-3">
        <CalendarDays color="#237A55" size={20} />
        <View className="min-w-0 flex-1 gap-1">
          <Text accessibilityRole="header" className="font-bold text-ink dark:text-white">
            {copy.title}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {copy.description}
          </Text>
        </View>
      </View>
      <View className="gap-4 sm:flex-row sm:items-start">
        <View className="min-w-0 flex-1">
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.start}
            keyboardType="numbers-and-punctuation"
            label={copy.startLabel}
            maxLength={10}
            onChangeText={onStartLocalDateChange}
            onSubmitEditing={onApply}
            placeholder={copy.datePlaceholder}
            value={startLocalDate}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.end}
            keyboardType="numbers-and-punctuation"
            label={copy.endLabel}
            maxLength={10}
            onChangeText={onEndLocalDateChange}
            onSubmitEditing={onApply}
            placeholder={copy.datePlaceholder}
            value={endLocalDate}
          />
        </View>
        <Button
          className="sm:mt-7"
          label={applying ? copy.applying : copy.apply}
          loading={applying}
          onPress={onApply}
          variant="accent"
        />
      </View>
    </View>
  );
}
