import type { CashFlowReport } from "@pisto/contracts";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FeatureBoundary } from "@/components/feature-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatMonthYear } from "@/i18n/format";
import { capitalizeFirst } from "./report-figures";
import { CashFlow, IncomeStatement, ReportFootnote, ReportSkeleton } from "./report-sections";
import type { ReportsScreenState } from "./state";

export type ReportMonthNavigation = {
  month: string;
  /** Absent for the month in progress: later months have no records yet. */
  onNext?: () => void;
  onPrevious: () => void;
};

type ReportsScreenProps = {
  cashFlow: {
    data: { report: CashFlowReport } | undefined;
    isError: boolean;
    isFetching: boolean;
    refetch: () => unknown;
  };
  locale: string;
  /** Present once the business time zone is known. */
  month: ReportMonthNavigation | undefined;
  onRetry: () => void;
  retrying: boolean;
  state: ReportsScreenState;
};

function MonthNavigator({ locale, month }: { locale: string; month: ReportMonthNavigation }) {
  const { t } = useTranslation();
  const label = capitalizeFirst(formatMonthYear(`${month.month}-01`, locale), locale);
  return (
    <View
      accessibilityLabel={t("reports.month.label")}
      className="flex-row items-center gap-1.5"
      role="group"
    >
      <Button
        accessibilityLabel={t("reports.month.previous")}
        onPress={month.onPrevious}
        size="icon"
        variant="outline"
      >
        <Icon as={ChevronLeft} className="text-foreground" size={16} />
      </Button>
      <View
        accessibilityLiveRegion="polite"
        className="h-9 min-w-44 flex-row items-center justify-center gap-2 rounded-md border border-border bg-card px-3"
      >
        <Icon as={CalendarDays} className="text-muted-foreground" size={15} />
        <Text className="font-ui text-sm">{label}</Text>
      </View>
      <Button
        accessibilityLabel={t("reports.month.next")}
        disabled={!month.onNext}
        onPress={month.onNext}
        size="icon"
        variant="outline"
      >
        <Icon as={ChevronRight} className="text-foreground" size={16} />
      </Button>
    </View>
  );
}

export function ReportsScreen({
  cashFlow,
  locale,
  month,
  onRetry,
  retrying,
  state,
}: ReportsScreenProps) {
  const { t } = useTranslation();
  return (
    <Page>
      <PageHeader
        actions={
          month && state.kind !== "denied" ? (
            <MonthNavigator locale={locale} month={month} />
          ) : undefined
        }
        description={t("reports.description")}
        title={t("reports.title")}
      />
      {state.kind === "ready" && state.isStale ? (
        <StaleNotice loading={retrying} onRetry={onRetry} />
      ) : null}
      {state.kind === "loading" ? (
        <ReportSkeleton />
      ) : (
        <FeatureBoundary
          copy={{
            deniedDescription: t("reports.deniedDescription"),
            deniedTitle: t("reports.deniedTitle"),
            loading: t("reports.loading"),
            offlineTitle: t("remote.offlineTitle"),
            retry: t("common.retry"),
            unavailableTitle: t("reports.unavailableTitle"),
          }}
          inline
          onRetry={onRetry}
          state={state}
        >
          {state.kind === "ready" ? (
            <View className="min-w-0 gap-4">
              <View className="min-w-0 flex-row flex-wrap items-start gap-4">
                <View className="min-w-0 shrink grow basis-[340px] lg:max-w-[440px]">
                  <IncomeStatement locale={locale} report={state.report} />
                </View>
                <View className="min-w-0 shrink grow basis-[420px]">
                  <CashFlow locale={locale} query={cashFlow} />
                </View>
              </View>
              <ReportFootnote locale={locale} report={state.report} />
            </View>
          ) : null}
        </FeatureBoundary>
      )}
    </Page>
  );
}
