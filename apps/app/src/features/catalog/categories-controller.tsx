import type { Category } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import type { RouteParam } from "@/lib/route-params";
import { CategoriesScreen, type CategoryCollectionState } from "./categories-screen";
import { CategoryArchiveDialog, CategoryNameDialog } from "./category-dialogs";
import { type CategoryListFilters, categoriesInfiniteOptions, flattenPages } from "./queries";
import { CapabilityRouteState } from "./route-state";
import { captureDialogFocus, type DialogFocus } from "./screen-heading";
import { parseSearchParam, parseStatusParam, statusParam, useSearchInput } from "./search-params";
import { hasStaleRead, readState } from "./state";

type CategoryDialogTarget = { kind: "create" } | { kind: "rename" | "archive"; category: Category };

type CategoryDialog = CategoryDialogTarget & { businessId: string; focus: DialogFocus };

export default function CategoriesController() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: RouteParam; status?: RouteParam }>();
  const filters: CategoryListFilters = {
    search: parseSearchParam(params.q),
    status: parseStatusParam(params.status),
  };
  const [search, setSearch] = useSearchInput(filters.search, (q) => router.setParams({ q }));
  const [dialog, setDialog] = useState<CategoryDialog>();
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  const canRead = permissions.includes("catalog:read");
  const categories = useInfiniteQuery(
    categoriesInfiniteOptions(canRead ? business?.id : undefined, filters),
  );

  if (access === "offline") return <CapabilityRouteState kind="offline" />;
  if (access === "loading") return <CapabilityRouteState kind="loading" />;
  if (access === "error" || access === "notFound") {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  if (!business || !canRead) {
    return (
      <CapabilityRouteState
        description={t("catalog.categories.deniedDescription")}
        kind="denied"
        title={t("catalog.categories.deniedTitle")}
      />
    );
  }

  const stale = hasStaleRead([businesses, categories]);
  const canManage = permissions.includes("catalog:manage");
  // A dialog may open on stale reads, but only a fresh read lets it send a first command.
  const canConfirm = canManage && !stale;
  // Rows kept from the previous filter must not stand in for a filter that cannot load offline.
  const read =
    categories.isPlaceholderData && categories.fetchStatus === "paused"
      ? "offline"
      : readState([categories]);
  const state: CategoryCollectionState =
    read === "ready"
      ? {
          status: "ready",
          hasNextPage: categories.hasNextPage,
          items: flattenPages(categories.data),
          loadingMore: categories.isFetchingNextPage,
          previous: categories.isPlaceholderData,
          refreshing: categories.isFetching,
          stale,
        }
      : { status: read === "notFound" ? "error" : read };
  const open = (target: CategoryDialogTarget) =>
    setDialog({ ...target, businessId: business.id, focus: captureDialogFocus() });
  const current = dialog?.businessId === business.id ? dialog : undefined;
  const close = () => setDialog(undefined);

  return (
    <>
      <CategoriesScreen
        canManage={canManage}
        onArchive={(category) => open({ category, kind: "archive" })}
        onClearFilters={() => {
          setSearch("");
          router.replace("/operate/catalog/categories");
        }}
        onCreate={() => open({ kind: "create" })}
        onLoadMore={() => void categories.fetchNextPage()}
        onRename={(category) => open({ category, kind: "rename" })}
        onRetry={() => {
          void businesses.refetch();
          void categories.refetch();
        }}
        onSearchChange={setSearch}
        onStatusChange={(status) => router.setParams({ status: statusParam(status) })}
        search={search}
        searching={search.trim() !== filters.search || categories.isPlaceholderData}
        state={state}
        status={filters.status}
        timeZone={business.timeZone}
      />
      {current?.kind === "archive" ? (
        <CategoryArchiveDialog
          businessId={business.id}
          canConfirm={canConfirm}
          category={current.category}
          focus={current.focus}
          key={`archive-${current.category.id}`}
          onClose={close}
        />
      ) : current ? (
        <CategoryNameDialog
          businessId={business.id}
          canConfirm={canConfirm}
          category={current.kind === "rename" ? current.category : null}
          focus={current.focus}
          key={current.kind === "rename" ? `rename-${current.category.id}` : "create"}
          onClose={close}
        />
      ) : null}
    </>
  );
}
