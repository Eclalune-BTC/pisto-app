import type { PayablesSummaryResponse, Purchase } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Lock, Plus, ReceiptText, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { isPositiveAmount, useRecordFormat } from "@/features/customers/format";
import { readState } from "@/features/customers/read-state";
import { firstParam } from "@/lib/route-params";

import { PurchasesTable } from "./purchases-table";
import {
  type PurchaseListFilters,
  payablesSummaryQueryOptions,
  purchasesQueryOptions,
} from "./queries";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";

const PAYABLE_FILTERS = ["all", "open", "paid"] as const;
type PayableFilter = (typeof PAYABLE_FILTERS)[number];

function parseFilter(value: string | undefined): PayableFilter {
  return PAYABLE_FILTERS.find((filter) => filter === value) ?? "all";
}

function PayableStats({ summary }: { summary: PayablesSummaryResponse["data"] }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const money = (minorUnits: string) =>
    format.money(minorUnits, summary.currency, summary.currencyMinorUnitDigits);
  return (
    <View className="gap-2">
      <StatGroup>
        <Stat
          detail={t("purchases.payables.openCount", { count: Number(summary.openPurchaseCount) })}
          label={t("purchases.payables.owed")}
          value={money(summary.outstandingMinorUnits)}
        />
        <Stat
          label={t("purchases.payables.dueSoon")}
          tone={isPositiveAmount(summary.dueSoonMinorUnits) ? "warning" : "default"}
          value={money(summary.dueSoonMinorUnits)}
        />
        <Stat
          label={t("purchases.payables.overdue")}
          tone={isPositiveAmount(summary.overdueMinorUnits) ? "destructive" : "default"}
          value={money(summary.overdueMinorUnits)}
        />
        <Stat
          detail={
            summary.nextDue
              ? t("purchases.payables.nextPaymentDetail", {
                  date: format.date(summary.nextDue.dueDate),
                  supplier: summary.nextDue.supplierName,
                })
              : t("purchases.payables.noNextPayment")
          }
          label={t("purchases.payables.nextPayment")}
          value={summary.nextDue ? money(summary.nextDue.balanceMinorUnits) : "—"}
        />
      </StatGroup>
      <Text className="text-xs text-muted-foreground">
        {t("purchases.payables.position", { date: format.date(summary.businessLocalDate) })}
      </Text>
    </View>
  );
}

function NewPurchaseLink({ variant = "default" }: { variant?: "default" | "outline" }) {
  const { t } = useTranslation();
  return (
    <Link asChild href="/operate/purchases/new">
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
        <Text>{t("purchases.payables.create")}</Text>
      </Button>
    </Link>
  );
}

export function PayablesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const filter = parseFilter(firstParam(useLocalSearchParams<{ payable?: string }>().payable));
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const filters: PurchaseListFilters = { payable: filter, status: "posted" };
  const list = useInfiniteQuery({ ...purchasesQueryOptions(businessId, filters), enabled });
  const summary = useQuery({ ...payablesSummaryQueryOptions(businessId), enabled });
  const [paying, setPaying] = useState<Purchase | null>(null);

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <RouteState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
      />
    );
  }
  const read = readState([list, summary]);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const canCreate = access.hasManagePermission;
  const retry = () => {
    void access.refetch();
    void list.refetch();
    void summary.refetch();
  };

  return (
    <Page>
      <PageHeader
        actions={canCreate && read.kind !== "denied" ? <NewPurchaseLink /> : undefined}
        description={t("purchases.payables.description")}
        title={t("purchases.payables.title")}
      />
      {read.kind === "denied" ? (
        <StatePanel
          description={t("purchases.access.deniedDescription")}
          icon={Lock}
          level={2}
          title={t("purchases.access.deniedTitle")}
        />
      ) : (
        <>
          {read.kind === "ready" && summary.data ? <PayableStats summary={summary.data} /> : null}
          <View accessibilityLabel={t("purchases.payables.filter")} role="toolbar">
            <FilterBar
              label={t("purchases.payables.filter")}
              onChange={(next) => router.setParams({ payable: next === "all" ? undefined : next })}
              options={[
                { label: t("purchases.payables.filterAll"), value: "all" },
                { label: t("purchases.payables.filterOpen"), value: "open" },
                { label: t("purchases.payables.filterPaid"), value: "paid" },
              ]}
              value={filter}
            />
          </View>
          {read.kind === "ready" && (read.stale || access.isStale) ? (
            <StaleNotice onRetry={retry} />
          ) : null}
          {read.kind === "loading" ? (
            <ContentSkeleton label={t("purchases.payables.loading")} variant="section" />
          ) : read.kind === "offline" ? (
            <OfflineState level={2} />
          ) : read.kind !== "ready" ? (
            <StatePanel
              action={
                <Button label={t("common.retry")} onPress={retry} size="sm" variant="outline" />
              }
              description={t("purchases.payables.errorDescription")}
              icon={TriangleAlert}
              level={2}
              title={t("purchases.payables.errorTitle")}
              tone="destructive"
            />
          ) : items.length === 0 ? (
            filter !== "all" ? (
              <EmptyState
                description={t(`purchases.payables.${filter}EmptyDescription`)}
                icon={ReceiptText}
                title={t(`purchases.payables.${filter}EmptyTitle`)}
              />
            ) : (
              <EmptyState
                action={canCreate ? <NewPurchaseLink variant="outline" /> : undefined}
                description={t("purchases.payables.allEmptyDescription")}
                icon={ReceiptText}
                title={t("purchases.payables.allEmptyTitle")}
              />
            )
          ) : (
            <View className="gap-3">
              <PurchasesTable
                caption={t("purchases.payables.title")}
                items={items}
                onRegisterPayment={access.hasManagePermission ? setPaying : undefined}
              />
              {list.hasNextPage ? (
                <View className="items-center">
                  <Button
                    label={t("common.loadMore")}
                    loading={list.isFetchingNextPage}
                    onPress={() => void list.fetchNextPage()}
                    size="sm"
                    variant="outline"
                  />
                </View>
              ) : null}
            </View>
          )}
        </>
      )}
      <SupplierPaymentDialog
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
        open={paying !== null}
        purchaseId={paying?.id}
      />
    </Page>
  );
}
