import type { ArchiveSupplierRequest, Purchase, SupplierDetailResponse } from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { Archive, HandCoins, Pencil, Plus } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DescriptionList } from "@/components/layout/description-list";
import { HeaderActions, type MenuTrigger } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { commandPhase } from "@/features/customers/command-state";
import { isPositiveAmount, useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { readState } from "@/features/customers/read-state";
import { useConfirmableCommand } from "@/features/customers/use-confirmable-command";
import { cn } from "@/lib/cn";
import { notify } from "@/lib/notify";
import { hasDeniedRead } from "@/lib/query-state";
import { firstParam } from "@/lib/route-params";

import { purchasesApi } from "./api";
import { PurchaseStateBadge } from "./presentation";
import { PurchasesTable } from "./purchases-table";
import { invalidatePurchaseMutation, purchasesQueryOptions, supplierQueryOptions } from "./queries";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";

const RECENT_PURCHASES = 5;

type SupplierData = SupplierDetailResponse["data"];

function supplierFacts(t: TFunction, data: SupplierData) {
  const { supplier } = data;
  const missing = t("purchases.supplier.notProvided");
  return [
    { label: t("purchases.supplier.contactName"), value: supplier.contactName ?? missing },
    { label: t("purchases.supplier.phone"), value: supplier.phone ?? missing },
    { label: t("purchases.supplier.email"), value: supplier.email ?? missing },
    { label: t("purchases.supplier.taxId"), value: supplier.taxId ?? missing },
    {
      label: t("purchases.supplier.creditDays"),
      value:
        supplier.creditDays === null
          ? missing
          : t("purchases.supplier.creditDaysValue", { count: supplier.creditDays }),
    },
  ];
}

function SupplierBalance({ data }: { data: SupplierData }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { balance } = data;
  const money = (minorUnits: string) =>
    format.money(minorUnits, balance.currency, balance.currencyMinorUnitDigits);
  return (
    <StatGroup>
      <Stat
        detail={t("purchases.supplier.openPurchases", { count: Number(balance.openPurchaseCount) })}
        label={t("purchases.supplier.owed")}
        value={money(balance.outstandingMinorUnits)}
      />
      <Stat
        label={t("purchases.supplier.overdue")}
        tone={isPositiveAmount(balance.overdueMinorUnits) ? "destructive" : "default"}
        value={money(balance.overdueMinorUnits)}
      />
    </StatGroup>
  );
}

function RecentPurchaseRows({ items }: { items: readonly Purchase[] }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const router = useRouter();
  return (
    <View className="overflow-hidden rounded-md border border-border">
      {items.map((purchase, index) => (
        <PressableSurface
          accessibilityRole="link"
          className={cn(
            "flex-row items-center justify-between gap-3 px-3 py-2",
            index > 0 && "border-t border-border",
          )}
          key={purchase.id}
          onPress={() =>
            router.push({
              pathname: "/operate/purchases/[purchaseId]",
              params: { purchaseId: purchase.id },
            })
          }
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-[13px]" numberOfLines={1}>
              {purchase.invoiceNumber ?? t("purchases.payables.noInvoice")} ·{" "}
              {format.date(purchase.occurredLocalDate)}
            </Text>
            <PurchaseStateBadge purchase={purchase} />
          </View>
          <MoneyText
            currency={purchase.currency}
            digits={purchase.currencyMinorUnitDigits}
            minorUnits={purchase.totalMinorUnits}
          />
        </PressableSurface>
      ))}
    </View>
  );
}

/** The side panel of the supplier list on wide screens. */
export function SupplierPanel({
  businessId,
  canManage,
  onEdit,
  onRegisterPayment,
  supplierId,
}: {
  businessId: string;
  canManage: boolean;
  onEdit: (data: SupplierData) => void;
  onRegisterPayment: (supplierId: string) => void;
  supplierId: string;
}) {
  const { t } = useTranslation();
  const detail = useQuery(supplierQueryOptions(businessId, supplierId));
  const purchases = useInfiniteQuery(
    purchasesQueryOptions(businessId, { payable: "all", status: "posted", supplierId }),
  );
  const read = readState([detail]);
  if (read.kind !== "ready" || !detail.data) {
    return (
      <View className="gap-3 rounded-lg border border-border bg-card p-4">
        {read.kind === "loading" ? (
          <>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          <View className="gap-2">
            <Text className="text-sm text-muted-foreground">
              {t("purchases.suppliers.errorTitle")}
            </Text>
            <Button
              className="self-start"
              label={t("common.retry")}
              onPress={() => void detail.refetch()}
              size="sm"
              variant="outline"
            />
          </View>
        )}
      </View>
    );
  }
  const data = detail.data;
  const facts = supplierFacts(t, data);
  const recent = purchases.data?.pages[0]?.items.slice(0, RECENT_PURCHASES) ?? [];
  const owes = isPositiveAmount(data.balance.outstandingMinorUnits);
  const active = data.supplier.status === "active";
  return (
    <View className="gap-4 rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <Heading level={2} size="section">
            {data.supplier.name}
          </Heading>
          {data.supplier.notes ? (
            <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
              {data.supplier.notes}
            </Text>
          ) : null}
        </View>
        {canManage && active ? (
          <Button onPress={() => onEdit(data)} size="sm" variant="ghost">
            <Icon as={Pencil} className="text-foreground" size={14} />
            <Text>{t("purchases.supplier.edit")}</Text>
          </Button>
        ) : null}
      </View>
      <View className="gap-1.5">
        {facts.map((fact) => (
          <View className="flex-row gap-3" key={fact.label}>
            <Text className="w-28 shrink-0 text-[13px] text-muted-foreground">{fact.label}</Text>
            <Text className="min-w-0 flex-1 text-[13px]" numberOfLines={2}>
              {fact.value}
            </Text>
          </View>
        ))}
      </View>
      <SupplierBalance data={data} />
      <View className="gap-2">
        <Text className="font-ui text-[13px] text-foreground">
          {t("purchases.supplier.recentPurchases")}
        </Text>
        {purchases.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : purchases.isError ? (
          <Text className="text-[13px] text-muted-foreground">
            {t("purchases.supplier.purchasesUnavailable")}
          </Text>
        ) : recent.length === 0 ? (
          <Text className="text-[13px] text-muted-foreground">
            {t("purchases.supplier.noRecentPurchases")}
          </Text>
        ) : (
          <RecentPurchaseRows items={recent} />
        )}
      </View>
      {canManage && active ? (
        <View className="flex-row flex-wrap justify-end gap-2">
          {owes ? (
            <Button
              label={t("purchases.supplier.registerPayment")}
              onPress={() => onRegisterPayment(data.supplier.id)}
              size="sm"
              variant="outline"
            />
          ) : null}
          <Link
            asChild
            href={{ pathname: "/operate/purchases/new", params: { supplierId: data.supplier.id } }}
          >
            <Button accessibilityRole="link" size="sm">
              <Text>{t("purchases.supplier.registerPurchase")}</Text>
            </Button>
          </Link>
        </View>
      ) : null}
    </View>
  );
}

/** The supplier record as its own route, for phones and links. */
export function SupplierDetailScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const supplierId = firstParam(
    useLocalSearchParams<{ supplierId?: string | string[] }>().supplierId,
  );
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const detail = useQuery({
    ...supplierQueryOptions(businessId, supplierId),
    enabled: enabled && supplierId !== undefined,
  });
  const purchases = useInfiniteQuery({
    ...purchasesQueryOptions(businessId, { payable: "all", status: "posted", supplierId }),
    enabled: enabled && supplierId !== undefined,
  });
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const menuTriggerRef = useRef<MenuTrigger>(null);
  const archive = useConfirmableCommand({
    conflictMessage: t("purchases.supplier.archiveNeedsZeroBalance"),
    mutationFn: (command: ArchiveSupplierRequest) => {
      if (!supplierId) throw new Error("Archiving requires the supplier");
      return purchasesApi.suppliers.archive(supplierId, command);
    },
    onConfirmed: async ({ supplier }) => {
      if (!businessId) throw new Error("Archiving requires the business");
      await invalidatePurchaseMutation(queryClient, businessId);
      notify.success(t("purchases.supplier.archived"), { description: supplier.name });
    },
  });
  const accessState = capabilityBoundaryState(access);
  useRouteLabel(
    "/operate/suppliers/[supplierId]",
    accessState === "ready" && !hasDeniedRead([detail]) ? detail.data?.supplier.name : undefined,
  );
  const data = detail.data;

  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <RouteState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
        variant="detail"
      />
    );
  }
  const read = supplierId ? readState([detail]) : ({ kind: "notFound" } as const);
  if (read.kind !== "ready" || !data) {
    return (
      <RouteState
        kind={read.kind === "ready" ? "error" : read.kind}
        onRetry={() => void detail.refetch()}
        title={read.kind === "notFound" ? t("purchases.supplier.notFoundTitle") : undefined}
        variant="detail"
      />
    );
  }
  const facts = supplierFacts(t, data);
  const canManage = access.hasManagePermission;
  const active = data.supplier.status === "active";
  const owes = isPositiveAmount(data.balance.outstandingMinorUnits);
  const stale = read.stale || access.isStale;
  const items = purchases.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Page>
      <PageHeader
        actions={
          canManage && active ? (
            <HeaderActions
              menuLabel={t("purchases.supplier.moreActions")}
              menuTriggerRef={menuTriggerRef}
              overflow={[
                {
                  icon: Pencil,
                  label: t("purchases.supplier.edit"),
                  onPress: () => setEditing(true),
                },
                {
                  destructive: true,
                  disabled: owes || stale,
                  disabledReason: owes
                    ? t("purchases.supplier.archiveNeedsZeroBalance")
                    : undefined,
                  icon: Archive,
                  label: t("purchases.supplier.archive"),
                  onPress: () => archive.onOpenChange(true),
                },
              ]}
              primary={{
                href: {
                  pathname: "/operate/purchases/new",
                  params: { supplierId: data.supplier.id },
                },
                icon: Plus,
                label: t("purchases.supplier.registerPurchase"),
              }}
              secondary={
                owes
                  ? [
                      {
                        disabled: stale,
                        icon: HandCoins,
                        label: t("purchases.supplier.registerPayment"),
                        onPress: () => setPaying(true),
                      },
                    ]
                  : []
              }
            />
          ) : undefined
        }
        adornment={
          active ? undefined : (
            <StatusBadge label={t("purchases.suppliers.archived")} tone="exception" />
          )
        }
        description={data.supplier.notes ?? undefined}
        title={data.supplier.name}
      />
      {stale ? <StaleNotice onRetry={() => void detail.refetch()} /> : null}
      <SupplierBalance data={data} />
      <DescriptionList items={facts} />
      <Section title={t("purchases.supplier.recentPurchases")}>
        {purchases.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : purchases.isError ? (
          <Text className="text-sm text-muted-foreground">
            {t("purchases.supplier.purchasesUnavailable")}
          </Text>
        ) : items.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            {t("purchases.supplier.noRecentPurchases")}
          </Text>
        ) : (
          <View className="gap-3">
            <PurchasesTable
              caption={t("purchases.supplier.recentPurchases")}
              items={items}
              showSupplier={false}
            />
            {purchases.hasNextPage ? (
              <View className="items-center">
                <Button
                  label={t("common.loadMore")}
                  loading={purchases.isFetchingNextPage}
                  onPress={() => void purchases.fetchNextPage()}
                  size="sm"
                  variant="outline"
                />
              </View>
            ) : null}
          </View>
        )}
      </Section>
      <SupplierFormDialog
        businessId={access.business.id}
        onOpenChange={setEditing}
        open={editing}
        supplier={data.supplier}
      />
      <SupplierPaymentDialog
        onOpenChange={setPaying}
        open={paying}
        returnFocusRef={menuTriggerRef}
        supplierId={data.supplier.id}
      />
      <ConfirmDialog
        confirmLabel={t("purchases.supplier.archiveConfirm")}
        description={t("purchases.supplier.archiveDescription")}
        destructive
        errorMessage={archive.state.phase === "failed" ? archive.state.message : undefined}
        onCancel={() => archive.onOpenChange(false)}
        onConfirm={() => archive.confirm(() => ({ idempotencyKey: Crypto.randomUUID() }))}
        open={archive.open}
        phase={commandPhase(archive.state)}
        returnFocus={menuTriggerRef}
        title={t("purchases.supplier.archiveTitle")}
        uncertainDescription={t("purchases.supplier.archiveUncertain")}
      />
    </Page>
  );
}
