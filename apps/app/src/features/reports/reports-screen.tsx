import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { FeatureBoundary, type FeatureBoundaryCopy } from "@/features/cash/feature-boundary";
import type { ReportRangeIssue } from "./date-range";
import { type ReportRangeCopy, ReportRangeSelector } from "./range-selector";
import { ReportSections, type ReportSectionsCopy } from "./report-sections";
import type { ReportsScreenState } from "./state";

export type ReportsScreenCopy = FeatureBoundaryCopy & {
  description: string;
  eyebrow: string;
  range: ReportRangeCopy;
  sections: ReportSectionsCopy;
  title: string;
};

type ReportsScreenProps = {
  applying: boolean;
  copy: ReportsScreenCopy;
  endLocalDate: string;
  issue: ReportRangeIssue | null;
  locale: string;
  onApply: () => void;
  onEndLocalDateChange: (value: string) => void;
  onRetry: () => void;
  onStartLocalDateChange: (value: string) => void;
  startLocalDate: string;
  state: ReportsScreenState;
};

export function ReportsScreen({
  applying,
  copy,
  endLocalDate,
  issue,
  locale,
  onApply,
  onEndLocalDateChange,
  onRetry,
  onStartLocalDateChange,
  startLocalDate,
  state,
}: ReportsScreenProps) {
  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={state}>
      {state.kind === "ready" ? (
        <Page contentContainerClassName="gap-8">
          <ScreenHeader description={copy.description} eyebrow={copy.eyebrow} title={copy.title} />
          {state.isStale ? <StaleNotice /> : null}
          <ReportRangeSelector
            applying={applying}
            copy={copy.range}
            endLocalDate={endLocalDate}
            issue={issue}
            onApply={onApply}
            onEndLocalDateChange={onEndLocalDateChange}
            onStartLocalDateChange={onStartLocalDateChange}
            startLocalDate={startLocalDate}
          />
          <ReportSections copy={copy.sections} locale={locale} report={state.report} />
        </Page>
      ) : null}
    </FeatureBoundary>
  );
}
