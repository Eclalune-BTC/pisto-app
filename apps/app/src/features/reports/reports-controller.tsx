import type { OperatingReportQuery } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { resolveBusinessPermission } from "@/features/customers/access";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

import { buildReportsCopy } from "./copy";
import {
  currentBusinessMonthRange,
  type ReportRangeIssue,
  validateReportRange,
} from "./date-range";
import { operatingReportQueryOptions } from "./queries";
import { ReportsScreen } from "./reports-screen";
import { reportsScreenState } from "./state";

const unseededRange: OperatingReportQuery = { endLocalDate: "", startLocalDate: "" };

export function ReportsController() {
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildReportsCopy(t), [t]);
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canRead = resolveBusinessPermission(business, "reports:read");
  const businessId = business?.id ?? "unselected";
  const timeZone = business?.timeZone;
  const [draftRange, setDraftRange] = useState<OperatingReportQuery>(unseededRange);
  const [appliedRange, setAppliedRange] = useState<OperatingReportQuery>(unseededRange);
  const [rangeIssue, setRangeIssue] = useState<ReportRangeIssue | null>(null);
  const seededBusinessId = useRef<string | null>(null);

  // A refetch hands back a new businesses payload, so the range is seeded once
  // per business rather than whenever that payload changes identity.
  useEffect(() => {
    if (!timeZone || seededBusinessId.current === businessId) return;
    seededBusinessId.current = businessId;
    const initialRange = currentBusinessMonthRange(timeZone);
    setDraftRange(initialRange);
    setAppliedRange(initialRange);
    setRangeIssue(null);
  }, [businessId, timeZone]);

  const seeded = Boolean(appliedRange.startLocalDate && appliedRange.endLocalDate);
  const report = useQuery({
    ...operatingReportQueryOptions(businessId, appliedRange),
    enabled: Boolean(business) && canRead && seeded,
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  const state = reportsScreenState({
    businesses,
    canRead,
    offlineMessage: copy.remote.offline,
    report,
    unavailableMessage: copy.remote.unavailable,
  });

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
