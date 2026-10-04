import type { Category } from "@pisto/contracts";
import { Archive, Lock, Pencil, Plus, Tags, TriangleAlert } from "lucide-react-native";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Icon } from "@/components/ui/icon";
import { RowActions } from "@/components/ui/row-actions";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { LoadMoreButton } from "../cash/load-more-button";
import { formatInstantDate } from "./format";
import type { CatalogStatusFilter } from "./queries";
import { SearchBox } from "./search-box";

export type CategoryCollectionState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: Category[];
      loadingMore: boolean;
      /** Results of the previous search or filter, kept on screen while the new ones load. */
      previous: boolean;
      refreshing: boolean;
      stale: boolean;
    };

type CategoriesScreenProps = {
  /** Catalog management confirmed by fresh reads. */
  canManage: boolean;
  onArchive: (category: Category) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onLoadMore: () => void;
  onRename: (category: Category) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: CatalogStatusFilter) => void;
  search: string;
  state: CategoryCollectionState;
  status: CatalogStatusFilter;
  timeZone: string;
};

export function CategoriesScreen({
  canManage,
  onArchive,
  onClearFilters,
  onCreate,
  onLoadMore,
  onRename,
  onRetry,
  onSearchChange,
  onStatusChange,
  search,
  state,
  status,
  timeZone,
}: CategoriesScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const columns = useMemo<DataTableColumn<Category>[]>(
    () => [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={2}>
            {original.name}
          </Text>
        ),
      },
      ...(status === "all"
        ? [
            {
              id: "status",
              header: t("dataTable.columns.status"),
              meta: { width: 120 },
              cell: ({ row: { original } }) => (
                <Badge
                  // Archived is the exception, so it carries the stronger chip.
                  className={original.status === "archived" ? "bg-foreground/20" : undefined}
                  variant={original.status === "archived" ? "secondary" : "outline"}
                >
                  <Text>{t(`catalog.categories.status.${original.status}`)}</Text>
                </Badge>
              ),
            } satisfies DataTableColumn<Category>,
          ]
        : []),
      {
        id: "createdAt",
        header: t("catalog.categories.createdAt"),
        meta: { align: "end", width: 140 },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
            {formatInstantDate(original.createdAt, locale, timeZone)}
          </Text>
        ),
      },
    ],
    [locale, status, t, timeZone],
  );

  if (state.status === "denied") {
    return (
      <Page width="form">
        <StatePanel
          description={t("catalog.categories.deniedDescription")}
          icon={Lock}
          level={1}
          title={t("catalog.categories.deniedTitle")}
        />
      </Page>
    );
  }

  const filtered = search.trim() !== "" || status !== "active";
  let body: ReactElement;
  if (state.status === "loading") {
    body = <ContentSkeleton label={t("catalog.categories.loading")} variant="section" />;
  } else if (state.status === "offline") {
    body = <OfflineState level={2} />;
  } else if (state.status === "error") {
    body = (
      <StatePanel
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        description={t("catalog.categories.unavailableDescription")}
        icon={TriangleAlert}
        level={2}
        title={t("catalog.categories.unavailableTitle")}
        tone="destructive"
      />
    );
  } else {
    body = (
      <View
        aria-busy={state.previous}
        className={cn("min-w-0 gap-3", state.previous && "opacity-60")}
      >
        <DataTable
          caption={t("catalog.categories.title")}
          columns={columns}
          data={state.items}
          empty={
            filtered ? (
              <EmptyState
                action={
                  <Button
                    label={t("filters.reset")}
                    onPress={onClearFilters}
                    size="sm"
                    variant="outline"
                  />
                }
                description={t("catalog.categories.emptyFilteredDescription")}
                icon={Tags}
                title={t("catalog.categories.emptyFilteredTitle")}
              />
            ) : (
              <EmptyState
                action={
                  canManage ? (
                    <Button label={t("catalog.categories.create")} onPress={onCreate} size="sm" />
                  ) : undefined
                }
                description={t("catalog.categories.emptyDescription")}
                icon={Tags}
                title={t("catalog.categories.emptyTitle")}
              />
            )
          }
          getRowHref={(category) => ({
            pathname: "/operate/catalog",
            params: { category: category.id },
          })}
          getRowId={(category) => category.id}
          rowActions={
            canManage
              ? (category) =>
                  category.status === "active" ? (
                    <RowActions
                      actions={[
                        {
                          icon: Pencil,
                          label: t("catalog.categories.rename"),
                          onPress: () => onRename(category),
                        },
                        {
                          destructive: true,
                          icon: Archive,
                          label: t("catalog.categories.archive"),
                          onPress: () => onArchive(category),
                        },
                      ]}
                      label={t("catalog.categories.rowActions", { name: category.name })}
                    />
                  ) : (
                    // Rows without a menu keep its width, so every date shares one edge.
                    <View aria-hidden className="size-8 native:size-10" />
                  )
              : undefined
          }
        />
        {state.previous ? null : (
          <LoadMoreButton
            page={{ hasMore: state.hasNextPage, loadingMore: state.loadingMore, onLoadMore }}
          />
        )}
      </View>
    );
  }

  return (
    <Page width="form">
      <PageHeader
        actions={
          canManage ? (
            <Button onPress={onCreate}>
              <Icon as={Plus} className="text-primary-foreground" size={16} />
              <Text>{t("catalog.categories.create")}</Text>
            </Button>
          ) : undefined
        }
        description={t("catalog.categories.description")}
        title={t("catalog.categories.title")}
      />
      {state.status === "ready" && state.stale ? (
        <StaleNotice loading={state.refreshing} onRetry={onRetry} />
      ) : null}
      <View className="min-w-0 gap-3">
        <FilterToolbar label={t("catalog.categories.filtersLabel")}>
          <View className="min-w-0 sm:w-72">
            <SearchBox
              label={t("catalog.categories.searchLabel")}
              onChange={onSearchChange}
              placeholder={t("catalog.categories.searchPlaceholder")}
              value={search}
            />
          </View>
          <FilterBar
            label={t("catalog.categories.statusLabel")}
            onChange={onStatusChange}
            options={(["active", "archived", "all"] as const).map((value) => ({
              label: t(`catalog.categories.statuses.${value}`),
              value,
            }))}
            value={status}
          />
        </FilterToolbar>
        {body}
      </View>
    </Page>
  );
}
