import type { Receivable } from "@pisto/contracts";
import { Archive, ArrowLeft, Pencil } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

import type { CustomerDetailLoadState, CustomersCopy } from "./types";

type CustomerDetailScreenProps = {
  canManage: boolean;
  copy: CustomersCopy;
  formatDate: (date: string) => string;
  formatMoney: (minorUnits: string, currency: string, digits: number) => string;
  onArchive: () => void;
  onBack: () => void;
  onCreateReceivable: () => void;
  onEdit: () => void;
  onLoadMoreReceivables: () => void;
  onOpenReceivable: (receivableId: string) => void;
  onRetry: () => void;
  state: CustomerDetailLoadState;
};

export function CustomerDetailScreen({
  canManage,
  copy,
  formatDate,
  formatMoney,
  onArchive,
  onBack,
  onCreateReceivable,
  onEdit,
  onLoadMoreReceivables,
  onOpenReceivable,
  onRetry,
  state,
}: CustomerDetailScreenProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<Receivable>[]>(
    () => [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original: item } }) => (
          <Button
            accessibilityLabel={t("dataTable.openRecord", { name: item.description })}
            className="justify-start px-0"
            label={item.description}
            onPress={() => onOpenReceivable(item.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original: item } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {formatDate(item.postedDate)}
          </Text>
        ),
      },
      {
        id: "outstanding",
        header: t("dataTable.columns.outstanding"),
        meta: { align: "end" },
        cell: ({ row: { original: item } }) => (
          <Text className="font-ui text-sm text-foreground">
            {formatMoney(item.outstandingMinorUnits, item.currency, item.currencyMinorUnitDigits)}
          </Text>
        ),
      },
    ],
    [formatDate, formatMoney, onOpenReceivable, t],
  );
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <LoadingIndicator />
        <Text className="font-sans text-sm text-muted-foreground">{copy.loading}</Text>
      </View>
    );
  }
  if (state.kind !== "ready") {
    const content =
      state.kind === "denied"
        ? { title: copy.deniedTitle, description: copy.deniedDescription }
        : state.kind === "offline"
          ? { title: copy.offlineTitle, description: copy.offlineDescription }
          : state.kind === "notFound"
            ? { title: copy.unavailableTitle, description: copy.unavailableDescription }
            : { title: copy.errorTitle, description: copy.errorDescription };
    return (
      <Page>
        <Button label={copy.back} onPress={onBack} variant="ghost" />
        <View className="gap-3 border-y border-border py-8">
          <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
            {content.title}
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted-foreground">
            {content.description}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="outline" />
          ) : null}
        </View>
      </Page>
    );
  }

  const { balance, customer } = state.detail;
  return (
    <Page contentContainerClassName="gap-8">
      <Button
        accessibilityLabel={copy.back}
        className="self-start px-0"
        onPress={onBack}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color="#71717A" size={18} />
        <Text className="font-ui text-foreground">{copy.back}</Text>
      </Button>
      <ScreenHeader
        action={
          canManage && customer.status === "active" ? (
            <View className="flex-row flex-wrap gap-2">
              <Button label={copy.newReceivable} onPress={onCreateReceivable} variant="default" />
              <Button onPress={onEdit} variant="outline">
                <Pencil color="#14241D" size={17} />
                <ButtonText variant="outline">{copy.update}</ButtonText>
              </Button>
              <Button onPress={onArchive} variant="ghost">
                <Archive color="#B94242" size={17} />
                <ButtonText className="text-destructive" variant="ghost">
                  {copy.archive}
                </ButtonText>
              </Button>
            </View>
          ) : undefined
        }
        description={customer.status === "archived" ? copy.archivedDescription : copy.contact}
        title={customer.name}
      />
      {state.stale ? (
        <View className="border-l-4 border-warning bg-muted p-3">
          <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
        </View>
      ) : null}
      <View className="gap-6 border-y border-border py-6 lg:flex-row">
        <View className="min-w-0 flex-1 gap-2">
          <Text className="text-xs font-ui text-muted-foreground">{copy.balance}</Text>
          <Text className="text-3xl font-heading text-foreground">
            {formatMoney(
              balance.outstandingMinorUnits,
              balance.currency,
              balance.currencyMinorUnitDigits,
            )}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.openReceivables}: {balance.openReceivableCount}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-2 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <Text className="text-xs font-ui text-muted-foreground">{copy.overdue}</Text>
          <Text className="text-2xl font-heading text-destructive">
            {formatMoney(
              balance.overdueMinorUnits,
              balance.currency,
              balance.currencyMinorUnitDigits,
            )}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {balance.overdueReceivableCount}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
          {copy.contact}
        </Text>
        <View className="gap-3 border-t border-border pt-4">
          {customer.phone ? (
            <Text className="font-sans text-sm text-foreground">
              {copy.phone}: {customer.phone}
            </Text>
          ) : null}
          {customer.email ? (
            <Text className="font-sans text-sm text-foreground">
              {copy.email}: {customer.email}
            </Text>
          ) : null}
          {customer.notes ? (
            <Text className="font-sans text-sm leading-5 text-muted-foreground">
              {copy.notes}: {customer.notes}
            </Text>
          ) : null}
          {!customer.phone && !customer.email && !customer.notes ? (
            <Text className="font-sans text-sm text-muted-foreground">{copy.noContact}</Text>
          ) : null}
        </View>
      </View>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
          {copy.receivableHistory}
        </Text>
        {state.receivables.length === 0 ? (
          <Text className="font-sans border-t border-border py-5 text-sm text-muted-foreground">
            {copy.noReceivables}
          </Text>
        ) : (
          <View className="gap-4">
            <DataTable
              caption={copy.receivableHistory}
              columns={columns}
              data={state.receivables}
              getRowId={(item) => item.id}
            />
            {state.receivablesNextCursor ? (
              <Button
                disabled={state.receivablesLoadingMore}
                label={copy.loadMore}
                loading={state.receivablesLoadingMore}
                onPress={onLoadMoreReceivables}
                variant="outline"
              />
            ) : null}
          </View>
        )}
      </View>
    </Page>
  );
}
