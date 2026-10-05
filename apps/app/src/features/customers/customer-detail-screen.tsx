import type { Customer } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import type { TFunction } from "i18next";
import { Archive, Lock, Pencil, Plus, ReceiptText, TriangleAlert } from "lucide-react-native";
import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { HeaderActions, type MenuTrigger } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { ReceivablesTable } from "@/features/receivables/receivables-table";
import { CustomerStatusBadge } from "./customer-status-badge";
import { isPositiveAmount, useRecordFormat } from "./format";
import type { CustomerDetailLoadState, CustomerReceivablesState } from "./types";

type CustomerDetailScreenProps = {
  /** Permission to post charges; contact changes and archiving need `canManage`. */
  canCharge: boolean;
  canManage: boolean;
  /** The overflow menu trigger, where focus returns after the archive dialog closes. */
  menuTriggerRef: RefObject<MenuTrigger | null>;
  /** An unresolved command shown above the record, such as an archive whose outcome is unknown. */
  notice?: ReactNode;
  onArchive: () => void;
  onLoadMoreReceivables: () => void;
  onRetry: () => void;
  state: CustomerDetailLoadState;
};

function newChargeHref(customerId: string): Href {
  return { pathname: "/operate/receivables/new", params: { customerId } };
}

function ReceivablesSection({
  canCharge,
  customer,
  onLoadMore,
  onRetry,
  receivables,
}: {
  canCharge: boolean;
  customer: Customer;
  onLoadMore: () => void;
  onRetry: () => void;
  receivables: CustomerReceivablesState;
}) {
  const { t } = useTranslation();
  const title = t("customers.detail.receivables");
  const active = customer.status === "active";
  return (
    <Section title={title}>
      {receivables.kind === "loading" ? (
        <ContentSkeleton variant="section" />
      ) : receivables.kind === "offline" ? (
        <OfflineState level={3} />
      ) : receivables.kind === "denied" ? (
        <StatePanel
          description={t("customers.detail.receivablesDenied")}
          icon={Lock}
          level={3}
          title={t("relationships.access.deniedTitle")}
        />
      ) : receivables.kind === "error" ? (
        <StatePanel
          action={
            <Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />
          }
          description={t("relationships.common.unavailableDescription")}
          icon={TriangleAlert}
          level={3}
          title={t("customers.detail.receivablesUnavailable")}
          tone="destructive"
        />
      ) : receivables.items.length === 0 ? (
        <EmptyState
          action={
            canCharge && active ? (
              <Link asChild href={newChargeHref(customer.id)}>
                <Button accessibilityRole="link" size="sm" variant="outline">
                  <Text>{t("customers.detail.newCharge")}</Text>
                </Button>
              </Link>
            ) : undefined
          }
          description={
            active
              ? t("customers.detail.noReceivablesDescription")
              : t("customers.detail.noReceivablesArchived")
          }
          icon={ReceiptText}
          title={t("customers.detail.noReceivablesTitle")}
        />
      ) : (
        <View className="gap-3">
          <ReceivablesTable caption={title} items={receivables.items} />
          {receivables.nextCursor ? (
            <View className="items-center">
              <Button
                label={t("common.loadMore")}
                loading={receivables.loadingMore}
                onPress={onLoadMore}
                size="sm"
                variant="outline"
              />
            </View>
          ) : null}
        </View>
      )}
    </Section>
  );
}

/** Only the contact data on record; missing fields are not listed one by one. */
function contactItems(t: TFunction, customer: Customer): DescriptionItem[] {
  const items: DescriptionItem[] = [];
  if (customer.phone) items.push({ label: t("customers.fields.phone"), value: customer.phone });
  if (customer.email) items.push({ label: t("customers.fields.email"), value: customer.email });
  if (customer.notes) items.push({ label: t("customers.fields.notes"), value: customer.notes });
  return items;
}

export function CustomerDetailScreen({
  canCharge,
  canManage,
  menuTriggerRef,
  notice,
  onArchive,
  onLoadMoreReceivables,
  onRetry,
  state,
}: CustomerDetailScreenProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  if (state.kind !== "ready") {
    return <RouteState kind={state.kind} onRetry={onRetry} variant="detail" />;
  }

  const { balance, customer } = state.detail;
  const active = customer.status === "active";
  const money = (minorUnits: string) =>
    format.money(minorUnits, balance.currency, balance.currencyMinorUnitDigits);
  const overdue = isPositiveAmount(balance.overdueMinorUnits);
  const editHref: Href = {
    pathname: "/operate/customers/[customerId]/edit",
    params: { customerId: customer.id },
  };
  const contact = contactItems(t, customer);

  return (
    <Page>
      <PageHeader
        actions={
          active && (canManage || canCharge) ? (
            <HeaderActions
              menuLabel={t("customers.detail.moreActions")}
              menuTriggerRef={menuTriggerRef}
              overflow={
                canManage
                  ? [
                      {
                        destructive: true,
                        disabledReason: isPositiveAmount(balance.outstandingMinorUnits)
                          ? t("customers.detail.archiveNeedsZeroBalance")
                          : undefined,
                        icon: Archive,
                        label: t("customers.detail.archive"),
                        onPress: onArchive,
                      },
                    ]
                  : []
              }
              primary={
                canCharge
                  ? {
                      href: newChargeHref(customer.id),
                      icon: Plus,
                      label: t("customers.detail.newCharge"),
                    }
                  : undefined
              }
              secondary={
                canManage
                  ? [{ href: editHref, icon: Pencil, label: t("customers.detail.edit") }]
                  : []
              }
            />
          ) : undefined
        }
        adornment={<CustomerStatusBadge status={customer.status} />}
        description={active ? undefined : t("customers.detail.archivedDescription")}
        title={customer.name}
      />
      {state.stale ? <StaleNotice onRetry={onRetry} /> : null}
      {notice}
      <StatGroup>
        <Stat
          detail={t("customers.detail.openCount", { count: Number(balance.openReceivableCount) })}
          label={t("customers.detail.outstanding")}
          value={money(balance.outstandingMinorUnits)}
        />
        <Stat
          detail={t("customers.detail.overdueCount", {
            count: Number(balance.overdueReceivableCount),
          })}
          label={t("customers.detail.overdue")}
          tone={overdue ? "destructive" : "default"}
          value={money(balance.overdueMinorUnits)}
        />
      </StatGroup>
      <Section title={t("customers.detail.contact")}>
        {contact.length > 0 ? (
          <DescriptionList items={contact} />
        ) : (
          <Text className="text-sm leading-5 text-muted-foreground">
            {t("customers.detail.noContact")}
          </Text>
        )}
      </Section>
      <ReceivablesSection
        canCharge={canCharge}
        customer={customer}
        onLoadMore={onLoadMoreReceivables}
        onRetry={onRetry}
        receivables={state.receivables}
      />
    </Page>
  );
}
