import type { OperatingReportQuery } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { resolveBusinessPermission } from "@/features/customers/access";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";
import { buildReportsCopy } from "./copy";
import {
  currentBusinessMonthRange,
  type ReportRangeIssue,
  validateReportRange,
} from "./date-range";
import { operatingReportQueryOptions } from "./queries";
import { ReportsScreen, type ReportsScreenState } from "./reports-screen";

const unseededRange: OperatingReportQuery = { endLocalDate: "", startLocalDate: "" };

export function ReportsController() {
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildReportsCopy(t), [t]);
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canRead = resolveBusinessPermission(business, "reports:read");
  const [draftRange, setDraftRange] = useState<OperatingReportQuery>(unseededRange);
  const [appliedRange, setAppliedRange] = useState<OperatingReportQuery>(unseededRange);
  const [rangeIssue, setRangeIssue] = useState<ReportRangeIssue | null>(null);

  useEffect(() => {
    if (!business) return;
    const initialRange = currentBusinessMonthRange(business.timeZone);
    setDraftRange(initialRange);
    setAppliedRange(initialRange);
    setRangeIssue(null);
  }, [business]);

  const businessId = business?.id ?? "unselected";
  const seeded = Boolean(appliedRange.startLocalDate && appliedRange.endLocalDate);
  const report = useQuery({
    ...operatingReportQueryOptions(businessId, appliedRange),
    enabled: Boolean(business) && canRead && seeded,
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  const remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: copy.remote.offline,
    queries: [businesses, ...(canRead ? [report] : [])],
    unavailableMessage: copy.remote.unavailable,
  });
  const stale = (businesses.isError && businesses.data !== undefined) || queryHasStaleData(report);
  const state: ReportsScreenState =
    remoteState.kind !== "ready"
      ? remoteState
      : report.data
        ? { isStale: stale, kind: "ready", report: report.data.report }
        : { kind: "loading" };

  const applyRange = () => {
    const validation = validateReportRange(draftRange);
    if (!validation.valid) {
      setRangeIssue(validation.issue);
      return;
    }
    setRangeIssue(null);
    setAppliedRange(validation.value);
  };
  const retry = () => {
    void Promise.all([businesses.refetch(), report.refetch()]);
  };

  return (
    <ReportsScreen
      applying={report.isFetching}
      copy={copy.screen}
      endLocalDate={draftRange.endLocalDate}
      issue={rangeIssue}
      locale={locale}
      onApply={applyRange}
      onEndLocalDateChange={(endLocalDate) => {
        setRangeIssue(null);
        setDraftRange((current) => ({ ...current, endLocalDate }));
      }}
      onRetry={retry}
      onStartLocalDateChange={(startLocalDate) => {
        setRangeIssue(null);
        setDraftRange((current) => ({ ...current, startLocalDate }));
      }}
      startLocalDate={draftRange.startLocalDate}
      state={state}
    />
  );
}
