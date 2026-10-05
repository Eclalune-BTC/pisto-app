import type { ReceivablesSummary } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import {
  ChevronDown,
  FilterX,
  Lock,
  Plus,
  ReceiptText,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react-native";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { isPositiveAmount, useRecordFormat } from "@/features/customers/format";

import type { ReceivableListParams, ReceivableStateFilter } from "./list-params";
import { type CustomerNameCell, ReceivablesTable } from "./receivables-table";
import type { ReceivablesLoadState } from "./types";

type ReceivablesScreenProps = {
  /** Permission to post receivables; it does not depend on the state of the list read. */
  canCreate: boolean;
  /** The customer the list is filtered by, when there is one. */
  customerFilter: CustomerNameCell | null;
  /** The customer filter control, where focus returns after the customer picker closes. */
  customerFilterRef: RefObject<View | null>;
  customerNameFor: (customerId: string) => CustomerNameCell;
  filters: ReceivableListParams;
  onChooseCustomer: () => void;
  onClearCustomer: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onStateChange: (state: ReceivableStateFilter) => void;
  state: ReceivablesLoadState;
};

const NEW_RECEIVABLE: Href = "/operate/receivables/new";

/** Below this window width the five state options no longer fit on one segmented row. */
const SEGMENTED_FILTER_MIN_WIDTH = 520;

function PositionStats({ summary }: { summary: ReceivablesSummary }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const money = (minorUnits: string) =>
    format.money(minorUnits, summary.currency, summary.currencyMinorUnitDigits);
  return (
    <View className="gap-2">
      <StatGroup>
        <Stat
          detail={t("receivables.summary.openCount", {
            count: Number(summary.openReceivableCount),
          })}
          label={t("receivables.summary.outstanding")}
          value={money(summary.outstandingMinorUnits)}
        />
        <Stat
          detail={t("receivables.summary.overdueCount", {
            count: Number(summary.overdueReceivableCount),
          })}
          label={t("receivables.summary.overdue")}
          tone={isPositiveAmount(summary.overdueMinorUnits) ? "destructive" : "default"}
          value={money(summary.overdueMinorUnits)}
        />
      </StatGroup>
      <Text className="text-xs text-muted-foreground">
        {t("receivables.summary.position", { date: format.date(summary.businessLocalDate) })}
      </Text>
    </View>
  );
}

function PositionSkeleton() {
  return (
    <View className="flex-row flex-wrap gap-px overflow-hidden rounded-lg border border-border bg-border">
      {[0, 1].map((index) => (
        <View className="min-w-[150px] flex-1 basis-[180px] gap-2 bg-card px-4 py-3" key={index}>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-24" />
        </View>
      ))}
    </View>
  );
}

function CustomerFilter({
  customer,
  onChoose,
  onClear,
  triggerRef,
}: {
  customer: CustomerNameCell | null;
  onChoose: () => void;
  onClear: () => void;
  triggerRef: RefObject<View | null>;
}) {
  const { t } = useTranslation();
  if (!customer) {
    return (
      <Button onPress={onChoose} ref={triggerRef} variant="outline">
        <Icon as={UserRound} className="text-muted-foreground" size={14} />
        <Text>{t("receivables.list.allCustomers")}</Text>
        <Icon as={ChevronDown} className="text-muted-foreground" size={14} />
      </Button>
    );
  }
  const name =
    customer.kind === "ready"
      ? customer.name
      : customer.kind === "loading"
        ? t("receivables.list.customerLoading")
        : t("receivables.list.customerUnavailable");
  return (
    <View className="max-w-full flex-row items-center gap-0.5">
      <Button
        accessibilityLabel={t("receivables.list.changeCustomer", { name })}
        className="max-w-[260px]"
        onPress={onChoose}
        ref={triggerRef}
        variant="outline"
      >
        <Icon as={UserRound} className="text-muted-foreground" size={14} />
        <Text numberOfLines={1}>{name}</Text>
      </Button>
      <Button
        accessibilityLabel={t("receivables.list.clearCustomer")}
        onPress={onClear}
        size="icon-sm"
        variant="ghost"
      >
        <Icon as={X} className="text-muted-foreground" size={14} />
      </Button>
    </View>
  );
}

function NewReceivableLink({ variant = "default" }: { variant?: "default" | "outline" }) {
  const { t } = useTranslation();
  return (
    <Link asChild href={NEW_RECEIVABLE}>
      <Button
        accessibilityRole="link"
        size={variant === "outline" ? "sm" : "default"}
        variant={variant}
      >
        <Icon
          as={Plus}
          className={variant === "outline" ? "text-foreground" : "text-primary-foreground"}
          size={16}
        />
        <Text>{t("receivables.list.create")}</Text>
      </Button>
    </Link>
  );
}

export function ReceivablesScreen({
  canCreate,
  customerFilter,
  customerFilterRef,
  customerNameFor,
  filters,
  onChooseCustomer,
  onClearCustomer,
  onClearFilters,
  onLoadMore,
  onRetry,
  onStateChange,
  state,
}: ReceivablesScreenProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const read = state.kind === "empty" || state.kind === "ready";
  const filtered = filters.state !== "all" || filters.customerId !== undefined;
  const stateOptions = [
    { value: "all", label: t("receivables.list.filterAll") },
    { value: "open", label: t("receivables.list.filterOpen") },
    { value: "overdue", label: t("receivables.list.filterOverdue") },
    { value: "paid", label: t("receivables.list.filterPaid") },
    { value: "voided", label: t("receivables.list.filterVoided") },
  ] as const;

  return (
    <Page>
      <PageHeader
        actions={canCreate && state.kind !== "denied" ? <NewReceivableLink /> : undefined}
        description={t("receivables.list.description")}
        title={t("receivables.list.title")}
      />
      {state.kind === "denied" ? (
        <StatePanel
          description={t("relationships.access.deniedDescription")}
          icon={Lock}
          level={2}
          title={t("receivables.list.deniedTitle")}
        />
      ) : (
        <>
          {read ? (
            <PositionStats summary={state.summary} />
          ) : state.kind === "loading" ? (
            <PositionSkeleton />
          ) : null}
          <View
            accessibilityLabel={t("receivables.list.filters")}
            className="flex-row flex-wrap items-end gap-2"
            role="toolbar"
          >
            {/* A server render has no window yet and keeps the segmented control. */}
            {width > 0 && width < SEGMENTED_FILTER_MIN_WIDTH ? (
              <View className="min-w-0 basis-full">
                <SelectField
                  label={t("receivables.list.stateFilter")}
                  labelHidden
                  onChange={onStateChange}
                  options={stateOptions}
                  value={filters.state}
                />
              </View>
            ) : (
              <FilterBar
                label={t("receivables.list.stateFilter")}
                onChange={onStateChange}
                options={stateOptions}
                value={filters.state}
              />
            )}
            <CustomerFilter
              customer={customerFilter}
              onChoose={onChooseCustomer}
              onClear={onClearCustomer}
              triggerRef={customerFilterRef}
            />
          </View>
          {read && state.stale ? <StaleNotice onRetry={onRetry} /> : null}
          {state.kind === "loading" ? (
            <ContentSkeleton label={t("receivables.list.loading")} variant="section" />
          ) : state.kind === "offline" ? (
            <OfflineState level={2} />
          ) : state.kind === "error" ? (
            <StatePanel
              action={
                <Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />
              }
              description={t("receivables.list.errorDescription")}
              icon={TriangleAlert}
              level={2}
              title={t("receivables.list.errorTitle")}
              tone="destructive"
            />
          ) : state.kind === "empty" ? (
            filtered ? (
              <EmptyState
                action={
                  <Button
                    label={t("receivables.list.clearFilters")}
                    onPress={onClearFilters}
                    size="sm"
                    variant="outline"
                  />
                }
                description={t("receivables.list.filteredEmptyDescription")}
                icon={FilterX}
                title={t("receivables.list.filteredEmptyTitle")}
              />
            ) : (
              <EmptyState
                action={canCreate ? <NewReceivableLink variant="outline" /> : undefined}
                description={t("receivables.list.emptyDescription")}
                icon={ReceiptText}
                title={t("receivables.list.emptyTitle")}
              />
            )
          ) : (
            <View className="gap-3">
              <ReceivablesTable
                caption={t("receivables.list.title")}
                // A list of one customer's receivables does not repeat the customer on every row.
                customerNameFor={filters.customerId ? undefined : customerNameFor}
                items={state.items}
                showState={filters.state === "all"}
              />
              {state.nextCursor ? (
                <View className="items-center">
                  <Button
                    label={t("common.loadMore")}
                    loading={state.loadingMore}
                    onPress={onLoadMore}
                    size="sm"
                    variant="outline"
                  />
                </View>
              ) : null}
            </View>
          )}
        </>
      )}
    </Page>
  );
}
