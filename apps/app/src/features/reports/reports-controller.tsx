import type { BusinessPermission, OperatingReportQuery } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { requireSupportedLocale } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { refetchEnabled } from "../cash/remote-state";
import {
  businessPresetRanges,
  matchingPreset,
  parseReportRangeParams,
  type ReportRangeIssue,
  type ReportRangeSearchParams,
  reportRangeParams,
  sameRange,
  validateReportRange,
} from "./date-range";
import { operatingReportQueryOptions } from "./queries";
import type { ReportRangeToolbarProps } from "./range-toolbar";
import { ReportsScreen } from "./reports-screen";
import { reportsScreenState } from "./state";

const unseededRange: OperatingReportQuery = { endLocalDate: "", startLocalDate: "" };

export function ReportsController() {
  const router = useRouter();
  const params = useLocalSearchParams<ReportRangeSearchParams>();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const can = (permission: BusinessPermission) =>
    business?.access.permissions.includes(permission) ?? false;
  const canRead = can("reports:read");
  // The default range and the presets are dates in the business time zone, unknown until it loads.
  const presets = business ? businessPresetRanges(business.timeZone) : undefined;
  const appliedRange = parseReportRangeParams(params) ?? presets?.thisMonth ?? unseededRange;
  const report = useQuery(
    operatingReportQueryOptions(canRead ? business?.id : undefined, appliedRange),
  );
  // Typed dates stay a draft of the business they were typed for until they are applied.
  const [draft, setDraft] = useState<{ businessId: string; range: OperatingReportQuery }>();
  const [issue, setIssue] = useState<ReportRangeIssue | null>(null);

  if (businesses.data && !business) return <Redirect href="/business" />;

  const state = reportsScreenState({
    businesses,
    canRead,
    offlineMessage: t("remote.offlineLoad"),
    report,
    unavailableMessage: t("reports.unavailable"),
  });

  let range: ReportRangeToolbarProps | undefined;
  if (business && presets) {
    const shown = draft?.businessId === business.id ? draft.range : appliedRange;
    const edit = (change: Partial<OperatingReportQuery>) => {
      setIssue(null);
      setDraft({ businessId: business.id, range: { ...shown, ...change } });
    };
    const apply = (next: OperatingReportQuery) => {
      setIssue(null);
      setDraft(undefined);
      router.setParams(reportRangeParams(next, presets.thisMonth));
    };
    range = {
      dirty: !sameRange(shown, appliedRange),
      endLocalDate: shown.endLocalDate,
      issue,
      onApply: () => {
        const validation = validateReportRange(shown);
        if (validation.valid) apply(validation.value);
        else setIssue(validation.issue);
      },
      onEndLocalDateChange: (endLocalDate) => edit({ endLocalDate }),
      onPresetChange: (preset) => apply(presets[preset]),
      onStartLocalDateChange: (startLocalDate) => edit({ startLocalDate }),
      preset: matchingPreset(shown, presets),
      startLocalDate: shown.startLocalDate,
    };
  }

  return (
    <ReportsScreen
      links={{
        cashAccounts: can("cash:read"),
        inventory: can("inventory:read"),
        receivables: can("receivables:read"),
      }}
      locale={locale}
      onRetry={() => void refetchEnabled([businesses, report])}
      range={range}
      retrying={businesses.isFetching || report.isFetching}
      state={state}
    />
  );
}
