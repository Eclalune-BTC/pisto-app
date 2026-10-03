import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";

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
    <Card className="gap-4 py-4 shadow-none">
      <CardHeader className="gap-1 px-4">
        <CardTitle aria-level={2} className="text-lg leading-6">
          {copy.title}
        </CardTitle>
        <CardDescription className="leading-6">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <DateRangeFilter
          applying={applying}
          applyLabel={applying ? copy.applying : copy.apply}
          endDate={endLocalDate}
          endLabel={copy.endLabel}
          endError={errors.end}
          error={errors.start}
          onApply={onApply}
          onEndDateChange={onEndLocalDateChange}
          onStartDateChange={onStartLocalDateChange}
          startDate={startLocalDate}
          startLabel={copy.startLabel}
        />
      </CardContent>
    </Card>
  );
}
