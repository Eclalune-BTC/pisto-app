import { useTranslation } from "react-i18next";
import { FeatureBoundary } from "@/components/feature-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ReportRangeToolbar, type ReportRangeToolbarProps } from "./range-toolbar";
import { type ReportLinks, ReportSections, ReportSkeleton } from "./report-sections";
import type { ReportsScreenState } from "./state";

type ReportsScreenProps = {
  links: ReportLinks;
  locale: string;
  onRetry: () => void;
  /** Present once the business time zone is known; the range stays editable while a read fails. */
  range: ReportRangeToolbarProps | undefined;
  retrying: boolean;
  state: ReportsScreenState;
};

export function ReportsScreen({
  links,
  locale,
  onRetry,
  range,
  retrying,
  state,
}: ReportsScreenProps) {
  const { t } = useTranslation();
  return (
    <Page>
      <PageHeader description={t("reports.description")} title={t("reports.title")} />
      {range && state.kind !== "denied" ? <ReportRangeToolbar {...range} /> : null}
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
            <ReportSections links={links} locale={locale} report={state.report} />
          ) : null}
        </FeatureBoundary>
      )}
    </Page>
  );
}
