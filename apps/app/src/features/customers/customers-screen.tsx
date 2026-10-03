import type { Customer } from "@pisto/contracts";
import { Search } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

import type { CustomersCopy, CustomersLoadState } from "./types";

type CustomersScreenProps = {
  canManage: boolean;
  copy: CustomersCopy;
  onCreate: () => void;
  onLoadMore: () => void;
  onOpenCustomer: (customerId: string) => void;
  onRetry: () => void;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: CustomerStatusFilter) => void;
  searchQuery: string;
  state: CustomersLoadState;
  status: CustomerStatusFilter;
};

export type CustomerStatusFilter = "active" | "archived" | "all";

function StateMessage({
  action,
  description,
  title,
}: {
  action?: { label: string; onPress: () => void };
  description: string;
  title: string;
}) {
  return (
    <Card className="gap-4 py-6 shadow-none">
      <CardHeader className="gap-2 px-4">
        <CardTitle aria-level={2} className="text-lg leading-6">
          {title}
        </CardTitle>
        <CardDescription className="max-w-[540px] leading-6">{description}</CardDescription>
      </CardHeader>
      {action ? (
        <CardFooter className="px-4">
          <Button label={action.label} onPress={action.onPress} variant="outline" />
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function CustomersScreen({
  canManage,
  copy,
  onCreate,
  onLoadMore,
  onOpenCustomer,
  onRetry,
  onSearchChange,
  onStatusChange,
  searchQuery,
  state,
  status,
}: CustomersScreenProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<Customer>[]>(
    () => [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({ row: { original: item } }) => (
          <Button
            accessibilityHint={copy.contact}
            accessibilityLabel={t("dataTable.openRecord", { name: item.name })}
            className="justify-start px-0"
            label={item.name}
            onPress={() => onOpenCustomer(item.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "email",
        header: t("dataTable.columns.email"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-foreground">{item.email ?? copy.noContact}</Text>
        ),
      },
      {
        id: "phone",
        header: t("dataTable.columns.phone"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-foreground">{item.phone ?? copy.noContact}</Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {item.status === "archived" ? copy.archived : copy.active}
          </Text>
        ),
      },
    ],
    [copy, onOpenCustomer, t],
  );
  const hasSuccessfulRead = state.kind === "empty" || state.kind === "ready";
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader
        action={
          canManage && hasSuccessfulRead ? (
            <Button label={copy.create} onPress={onCreate} variant="default" />
          ) : undefined
        }
        description={copy.description}
        title={copy.title}
      />

      {state.kind !== "denied" ? (
        <FilterToolbar label={copy.filterLabel}>
          <View className="min-w-0 flex-1 sm:min-w-64">
            <Field
              accessibilityLabel={copy.searchLabel}
              label={copy.searchLabel}
              onChangeText={onSearchChange}
              placeholder={copy.searchPlaceholder}
              trailing={<Search color="#617168" size={18} />}
              value={searchQuery}
            />
          </View>
          <FilterBar
            label={copy.filterLabel}
            onChange={onStatusChange}
            options={[
              { value: "active", label: copy.active },
              { value: "archived", label: copy.archived },
              { value: "all", label: copy.all },
            ]}
            value={status}
          />
        </FilterToolbar>
      ) : null}

      {hasSuccessfulRead && state.stale ? (
        <View className="border-l-4 border-warning bg-muted p-3">
          <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
        </View>
      ) : null}

      {state.kind === "loading" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-border">
          <LoadingIndicator />
          <Text className="text-sm font-ui text-muted-foreground">{copy.loading}</Text>
        </View>
      ) : state.kind === "offline" ? (
        <StateMessage description={copy.offlineDescription} title={copy.offlineTitle} />
      ) : state.kind === "denied" ? (
        <StateMessage description={copy.deniedDescription} title={copy.deniedTitle} />
      ) : state.kind === "error" ? (
        <StateMessage
          action={{ label: copy.retry, onPress: onRetry }}
          description={copy.errorDescription}
          title={copy.errorTitle}
        />
      ) : state.kind === "empty" ? (
        <EmptyState
          action={
            canManage && !searchQuery ? (
              <Button label={copy.emptyAction} onPress={onCreate} variant="outline" />
            ) : undefined
          }
          description={searchQuery ? copy.searchEmptyDescription : copy.emptyDescription}
          title={searchQuery ? copy.searchEmptyTitle : copy.emptyTitle}
        />
      ) : (
        <View className="gap-4">
          <DataTable
            caption={copy.title}
            columns={columns}
            data={state.items}
            getRowId={(item) => item.id}
          />
          {state.nextCursor ? (
            <Button
              label={copy.loadMore}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="outline"
            />
          ) : null}
        </View>
      )}
    </Page>
  );
}
