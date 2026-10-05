import { maximumInclusiveDays } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { FieldError } from "@/components/ui/field-error";
import { FilterBar } from "@/components/ui/filter-bar";
import { type ReportRangeIssue, type ReportRangePreset, reportRangePresets } from "./date-range";

export type ReportRangeToolbarProps = {
  /** The shown dates differ from the report on screen until they are applied. */
  dirty: boolean;
  /** The dates shown in the fields, applied or not. */
  endLocalDate: string;
  issue: ReportRangeIssue | null;
  onApply: () => void;
  onEndLocalDateChange: (value: string) => void;
  onPresetChange: (preset: ReportRangePreset) => void;
  onStartLocalDateChange: (value: string) => void;
  /** The preset the shown dates match; `custom` selects none. */
  preset: ReportRangePreset | "custom";
  startLocalDate: string;
};

function issueMessage(t: TFunction, issue: ReportRangeIssue): string {
  switch (issue) {
    case "invalid-start":
      return t("reports.range.invalidStart");
    case "invalid-end":
      return t("reports.range.invalidEnd");
    case "reversed":
      return t("reports.range.reversed");
    case "too-long":
      return t("reports.range.tooLong", { days: maximumInclusiveDays });
  }
}

/** A preset applies at once; typed dates wait for "Aplicar" so a half-typed date never queries. */
export function ReportRangeToolbar({
  dirty,
  endLocalDate,
  issue,
  onApply,
  onEndLocalDateChange,
  onPresetChange,
  onStartLocalDateChange,
  preset,
  startLocalDate,
}: ReportRangeToolbarProps) {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t("reports.range.label")} className="min-w-0 gap-2" role="group">
      <View className="min-w-0 flex-row flex-wrap items-end gap-x-4 gap-y-3">
        <FilterBar<ReportRangePreset | "custom">
          label={t("reports.range.label")}
          onChange={(next) => {
            if (next !== "custom") onPresetChange(next);
          }}
          options={reportRangePresets.map((value) => ({
            label: t(`reports.range.presets.${value}`),
            value,
          }))}
          value={preset}
        />
        {/* Below 132 px a date field clips its year, so a narrow phone wraps "Aplicar" instead. */}
        <View className="w-full min-w-0 flex-row flex-wrap items-end gap-2 sm:w-auto">
          <View className="min-w-[132px] flex-1 sm:w-40 sm:flex-none">
            <DateField
              label={t("reports.range.start")}
              onChange={onStartLocalDateChange}
              onSubmit={onApply}
              value={startLocalDate}
            />
          </View>
          <View className="min-w-[132px] flex-1 sm:w-40 sm:flex-none">
            <DateField
              label={t("reports.range.end")}
              onChange={onEndLocalDateChange}
              onSubmit={onApply}
              value={endLocalDate}
            />
          </View>
          <Button
            label={t("reports.range.apply")}
            onPress={onApply}
            variant={dirty ? "default" : "outline"}
          />
        </View>
      </View>
      {/* One message for the pair keeps both fields on the same line. */}
      <FieldError message={issue ? issueMessage(t, issue) : undefined} />
    </View>
  );
}
