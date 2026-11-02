import type { BusinessPermission } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { requireSupportedLocale } from "@/i18n/locale";
import { currentLocalDateTime } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { refetchEnabled } from "../cash/remote-state";
import {
  monthRange,
  parseMonthParam,
  type ReportMonthSearchParams,
  shiftMonth,
} from "./date-range";
import { cashFlowReportQueryOptions, operatingReportQueryOptions } from "./queries";
import { type ReportMonthNavigation, ReportsScreen } from "./reports-screen";
import { reportsScreenState } from "./state";

/** Six months of cash flow fit the chart and the table on one screen. */
const CASH_FLOW_MONTHS = 6;

export function ReportsController() {
  const router = useRouter();
  const params = useLocalSearchParams<ReportMonthSearchParams>();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const can = (permission: BusinessPermission) =>
    business?.access.permissions.includes(permission) ?? false;
  const canRead = can("reports:read");
  // Months are business-local, unknown until the business and its time zone load.
  const today = business ? currentLocalDateTime(business.timeZone).date : undefined;
  const currentMonth = today?.slice(0, 7);
  const month = currentMonth ? parseMonthParam(params.month, currentMonth) : undefined;
  const range =
    month && today ? monthRange(month, today) : { endLocalDate: "", startLocalDate: "" };
  const readableBusinessId = canRead ? business?.id : undefined;
  const report = useQuery(operatingReportQueryOptions(readableBusinessId, range));
  const cashFlow = useQuery(
    cashFlowReportQueryOptions(readableBusinessId, month ?? "", CASH_FLOW_MONTHS),
  );

  if (businesses.data && !business) return <Redirect href="/business" />;

  const state = reportsScreenState({
    businesses,
    canRead,
    offlineMessage: t("remote.offlineLoad"),
    report,
    unavailableMessage: t("reports.unavailable"),
  });

  let navigation: ReportMonthNavigation | undefined;
  if (month && currentMonth) {
    // The current month keeps a clean URL.
    const show = (next: string) =>
      router.setParams({ month: next === currentMonth ? undefined : next });
    navigation = {
      month,
      onNext: month < currentMonth ? () => show(shiftMonth(month, 1)) : undefined,
      onPrevious: () => show(shiftMonth(month, -1)),
    };
  }

  return (
    <ReportsScreen
      cashFlow={cashFlow}
      locale={locale}
      month={navigation}
      onRetry={() => void refetchEnabled([businesses, report, cashFlow])}
      retrying={businesses.isFetching || report.isFetching}
      state={state}
    />
  );
}
