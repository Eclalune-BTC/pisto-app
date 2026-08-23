import type { OperatingReport } from "@pisto/contracts";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import type { FeatureRemoteState } from "@/features/cash/feature-boundary";
import type { ReportRangeIssue } from "./date-range";
import { type ReportRangeCopy, ReportRangeSelector } from "./range-selector";
import { ReportSections, type ReportSectionsCopy } from "./report-sections";

export type ReportsScreenState =
  | Exclude<FeatureRemoteState, { kind: "ready" }>
  | { isStale: boolean; kind: "ready"; report: OperatingReport };

export type ReportsScreenCopy = {
  deniedDescription: string;
  deniedTitle: string;
  description: string;
  eyebrow: string;
  loading: string;
  offlineTitle: string;
  range: ReportRangeCopy;
  retry: string;
  sections: ReportSectionsCopy;
  title: string;
  unavailableTitle: string;
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

function MessageState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
      <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
        {title}
      </Text>
      <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {description}
      </Text>
      {action}
    </View>
  );
}

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
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {copy.loading}
        </Text>
      </View>
    );
  }
  if (state.kind === "denied") {
    return (
      <Page>
        <MessageState description={copy.deniedDescription} title={copy.deniedTitle} />
      </Page>
    );
  }
  if (state.kind === "offline" || state.kind === "error") {
    return (
      <Page>
        <MessageState
          action={<Button label={copy.retry} onPress={onRetry} variant="secondary" />}
          description={state.message}
          title={state.kind === "offline" ? copy.offlineTitle : copy.unavailableTitle}
        />
      </Page>
    );
  }

  return (
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
  );
}
