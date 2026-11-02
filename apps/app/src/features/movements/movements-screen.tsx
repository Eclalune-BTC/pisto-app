import type { Movement, MovementList } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeftRight, TriangleAlert } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { SearchField } from "@/components/ui/search-field";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { activeCashAccountsInfiniteOptions } from "@/features/cash/queries";
import { formatLocalDateFull } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { currentLocalDateTime } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/lib/use-debounced-value";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import {
  EntrySourceTag,
  MovementAmount,
  MovementIcon,
  MovementLink,
  MovementRow,
  type MovementRowFormat,
  movementAccessibilityLabel,
  movementFormat,
} from "./movement-row";
import {
  MOVEMENT_RANGES,
  MOVEMENT_TABS,
  type MovementListParams,
  type MovementRange,
  type MovementSearchParams,
  type MovementTab,
  movementFilters,
  movementSearchParams,
  parseMovementParams,
} from "./params";
import { movementKindLabel, movementSubtitle, movementTitle } from "./presentation";
import { movementsInfiniteOptions } from "./queries";

const TABLE_MIN_WIDTH = 720;

/** The period's figures; the period control sits in the same strip, as in the prototype. */
function Totals({
  format,
  list,
  loading,
  range,
}: {
  format: MovementRowFormat;
  list: MovementList | undefined;
  loading: boolean;
  range: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("movements.totals.label")}
      className="flex-row flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border"
      role="group"
    >
      {list ? (
        <TotalFigures format={format} list={list} />
      ) : loading ? (
        <View aria-hidden className="min-w-[260px] flex-[3] flex-row gap-4 bg-card px-5 py-4">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </View>
      ) : null}
      <View className="min-w-[260px] flex-1 items-start justify-center bg-card px-4 py-3 lg:items-end">
        {range}
      </View>
    </View>
  );
}

function TotalFigures({ format, list }: { format: MovementRowFormat; list: MovementList }) {
  const { t } = useTranslation();
  return (
    <>
      {[
        {
          key: "inflow",
          label: t("movements.totals.inflow"),
          value: format.signedMoney(list.totals.inflowMinorUnits),
          className: list.totals.inflowMinorUnits === "0" ? "" : "text-positive-foreground",
        },
        {
          key: "outflow",
          label: t("movements.totals.outflow"),
          value:
            list.totals.outflowMinorUnits === "0"
              ? format.money("0")
              : format.money(`-${list.totals.outflowMinorUnits}`),
          className: "",
        },
        {
          key: "net",
          label: t("movements.totals.net"),
          value: format.signedMoney(list.totals.netMinorUnits),
          className: "",
        },
      ].map((figure) => (
        <View
          className="min-w-[110px] flex-1 basis-[110px] gap-1 bg-card px-4 py-3.5 sm:px-5 sm:py-4"
          key={figure.key}
        >
          <Text className="text-xs leading-4 text-muted-foreground">{figure.label}</Text>
          <Text
            className={cn(
              "font-heading text-[19px] leading-7 tracking-[-0.4px] tabular-nums sm:text-[26px] sm:leading-8 sm:tracking-[-0.6px]",
              figure.className,
            )}
            numberOfLines={1}
          >
            {figure.value}
          </Text>
        </View>
      ))}
    </>
  );
}

function DayHeader({
  day,
  format,
  label,
}: {
  day: MovementList["days"][number] | undefined;
  format: MovementRowFormat;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="min-h-9 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-muted/60 px-4 py-2">
      <Text accessibilityRole="header" aria-level={2} className="font-ui text-xs text-foreground">
        {label}
      </Text>
      {day ? (
        <Text className="text-xs text-muted-foreground tabular-nums">
          {t("movements.totals.day", {
            inflow: format.signedMoney(day.inflowMinorUnits),
            outflow:
              day.outflowMinorUnits === "0"
                ? format.money("0")
                : format.money(`-${day.outflowMinorUnits}`),
          })}
        </Text>
      ) : null}
    </View>
  );
}

function WideRow({ format, movement }: { format: MovementRowFormat; movement: Movement }) {
  const { t } = useTranslation();
  const subtitle = movementSubtitle(t, movement, format.money);
  return (
    <MovementLink label={movementAccessibilityLabel(t, movement, format)} movement={movement}>
      <View className="min-h-[52px] flex-row items-center gap-4 border-b border-border px-4 py-2">
        <Text className="w-12 text-[13px] text-muted-foreground tabular-nums">
          {movement.occurredLocalTime}
        </Text>
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <MovementIcon movement={movement} />
          <View className="min-w-0 flex-1">
            <Text className="font-ui text-[13px] leading-5" numberOfLines={1}>
              {movementTitle(t, movement)}
            </Text>
            {subtitle ? (
              <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <Text className="w-24 text-[13px]" numberOfLines={1}>
          {movementKindLabel(t, movement.kind)}
        </Text>
        <View className="w-24">
          <EntrySourceTag movement={movement} />
        </View>
        <Text className="w-32 text-[13px] text-muted-foreground" numberOfLines={1}>
          {movement.accountName ?? t("movements.noAccount")}
        </Text>
        <View className="w-28 items-end">
          <MovementAmount format={format} movement={movement} />
        </View>
      </View>
    </MovementLink>
  );
}

function LedgerSkeleton() {
  return (
    <View aria-hidden className="overflow-hidden rounded-xl border border-border bg-card">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <View
          className="h-[52px] flex-row items-center gap-4 border-b border-border px-4"
          key={index}
        >
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
        </View>
      ))}
    </View>
  );
}

export default function MovementsScreen() {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const ledger = useMeasuredWidth();
  const params = parseMovementParams(useLocalSearchParams<MovementSearchParams>());
  const [search, setSearch] = useState(params.query);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const businesses = useQuery(businessesQueryOptions);
  const denied = hasDeniedRead([businesses]);
  const business = denied ? undefined : getActiveBusiness(businesses.data);
  const canRead = business?.access.permissions.includes("cash:read") ?? false;
  const today = business ? currentLocalDateTime(business.timeZone).date : undefined;
  const filters = today ? movementFilters(params, today, debouncedSearch) : undefined;
  const list = useInfiniteQuery(
    movementsInfiniteOptions(canRead ? business?.id : undefined, filters),
  );
  const accounts = useInfiniteQuery(
    activeCashAccountsInfiniteOptions(canRead ? business?.id : undefined),
  );
  const format = movementFormat(business?.currency, business?.currencyMinorUnitDigits, locale);

  if (denied) return <RouteState kind="denied" />;
  if (businesses.isPending) return <RouteState kind="loading" label={t("movements.loading")} />;
  if (businesses.isError && !businesses.data) {
    return <RouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (!business || !format || !today) return <Redirect href="/business" />;
  if (!canRead) return <RouteState kind="denied" />;

  const update = (change: Partial<MovementListParams>) =>
    router.setParams(movementSearchParams({ ...params, query: search, ...change }));
  const first = list.data?.pages[0];
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const days = new Map(
    list.data?.pages.flatMap((page) => page.days.map((day) => [day.localDate, day] as const)),
  );
  const groups: { localDate: string; items: Movement[] }[] = [];
  for (const movement of items) {
    const group = groups.at(-1);
    if (group?.localDate === movement.occurredLocalDate) group.items.push(movement);
    else groups.push({ localDate: movement.occurredLocalDate, items: [movement] });
  }
  const filtered = params.kind !== "all" || Boolean(params.accountId) || Boolean(filters?.query);
  const wide = ledger.width >= TABLE_MIN_WIDTH;
  const accountOptions = [
    { label: t("movements.filters.allAccounts"), value: "all" },
    ...(accounts.data?.pages.flatMap((page) =>
      page.items.map((account) => ({ label: account.name, value: account.id })),
    ) ?? []),
  ];

  return (
    <Page>
      <PageHeader description={t("movements.description")} title={t("movements.title")} />

      <Totals
        format={format}
        list={first}
        loading={list.isPending}
        range={
          <FilterBar<MovementRange>
            label={t("movements.filters.range")}
            onChange={(range) => update({ range })}
            options={MOVEMENT_RANGES.map((value) => ({
              label: t(`movements.filters.presets.${value}`),
              value,
            }))}
            value={params.range}
          />
        }
      />

      <View className="gap-3" onLayout={ledger.onLayout}>
        <View className="flex-row flex-wrap items-center gap-2">
          <FilterBar<MovementTab>
            label={t("movements.tabs.label")}
            onChange={(kind) => update({ kind })}
            options={MOVEMENT_TABS.map((value) => ({
              label: t(`movements.tabs.${value}`),
              value,
            }))}
            value={params.kind}
          />
          <View className="w-full sm:w-52">
            <SelectField
              label={t("movements.filters.account")}
              labelHidden
              onChange={(value) => update({ accountId: value === "all" ? undefined : value })}
              options={accountOptions}
              value={params.accountId ?? "all"}
            />
          </View>
          <View className="w-full sm:ml-auto sm:w-64">
            <SearchField
              busy={search !== debouncedSearch || (list.isFetching && !list.isFetchingNextPage)}
              clearLabel={t("movements.filters.clearSearch")}
              label={t("movements.filters.search")}
              maxLength={80}
              onChangeText={(value) => {
                setSearch(value);
                router.setParams(movementSearchParams({ ...params, query: value }));
              }}
              placeholder={t("movements.filters.search")}
              value={search}
            />
          </View>
        </View>

        {list.isPending ? (
          <LedgerSkeleton />
        ) : list.isError && !list.data ? (
          <StatePanel
            action={
              <Button
                label={t("common.retry")}
                onPress={() => void list.refetch()}
                size="sm"
                variant="outline"
              />
            }
            description={t("movements.unavailable")}
            icon={TriangleAlert}
            level={2}
            title={t("movements.unavailableTitle")}
          />
        ) : items.length === 0 ? (
          <EmptyState
            action={
              filtered ? (
                <Button
                  label={t("movements.filters.clear")}
                  onPress={() => {
                    setSearch("");
                    router.setParams(
                      movementSearchParams({
                        accountId: undefined,
                        kind: "all",
                        query: "",
                        range: params.range,
                      }),
                    );
                  }}
                  size="sm"
                  variant="outline"
                />
              ) : undefined
            }
            description={
              filtered ? t("movements.noMatchesDescription") : t("movements.emptyDescription")
            }
            icon={ArrowLeftRight}
            title={filtered ? t("movements.noMatchesTitle") : t("movements.emptyTitle")}
          />
        ) : (
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            {wide ? (
              <View
                aria-hidden
                className="h-9 flex-row items-center gap-4 border-b border-border px-4"
              >
                {(
                  [
                    ["time", "w-12"],
                    ["detail", "flex-1"],
                    ["kind", "w-24"],
                    ["source", "w-24"],
                    ["account", "w-32"],
                    ["amount", "w-28 text-right"],
                  ] as const
                ).map(([column, className]) => (
                  <Text className={cn("text-xs text-muted-foreground", className)} key={column}>
                    {t(`movements.columns.${column}`)}
                  </Text>
                ))}
              </View>
            ) : null}
            {groups.map((group) => (
              <View key={group.localDate} role="list">
                <DayHeader
                  day={days.get(group.localDate)}
                  format={format}
                  label={
                    group.localDate === today
                      ? t("movements.today", {
                          date: formatLocalDateFull(group.localDate, locale, { year: false }),
                        })
                      : capitalize(formatLocalDateFull(group.localDate, locale, { year: false }))
                  }
                />
                {group.items.map((movement) =>
                  wide ? (
                    <WideRow
                      format={format}
                      key={`${movement.kind}:${movement.recordId}`}
                      movement={movement}
                    />
                  ) : (
                    <View
                      className="border-b border-border"
                      key={`${movement.kind}:${movement.recordId}`}
                    >
                      <MovementRow format={format} movement={movement} />
                    </View>
                  ),
                )}
              </View>
            ))}
          </View>
        )}
        {list.isFetchNextPageError ? (
          <Text className="self-center text-xs text-destructive" role="alert">
            {t("movements.moreFailed")}
          </Text>
        ) : null}
        <LoadMoreButton
          label={t("movements.loadMore")}
          page={{
            hasMore: Boolean(list.hasNextPage),
            loadingMore: list.isFetchingNextPage,
            onLoadMore: () => void list.fetchNextPage(),
          }}
        />
      </View>
    </Page>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}
