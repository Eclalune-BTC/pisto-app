import type { Customer } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import {
  Archive,
  Ellipsis,
  Lock,
  Pencil,
  Plus,
  ReceiptText,
  TriangleAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { ReceivablesTable } from "@/features/receivables/receivables-table";

import { CustomerStatusBadge } from "./customer-status-badge";
import { isPositiveAmount, useRecordFormat } from "./format";
import { ScreenState } from "./screen-state";
import type { CustomerDetailLoadState, CustomerReceivablesState } from "./types";

type CustomerDetailScreenProps = {
  /** Charges need receivable management; contact changes need customer management. */
  canCharge: boolean;
  canManage: boolean;
  onArchive: () => void;
  onLoadMoreReceivables: () => void;
  onRetry: () => void;
  state: CustomerDetailLoadState;
};

function NotProvided() {
  const { t } = useTranslation();
  return (
    <Text className="text-sm leading-5 text-muted-foreground">
      {t("customers.detail.notProvided")}
    </Text>
  );
}

function newChargeHref(customerId: string): Href {
  return { pathname: "/operate/receivables/new", params: { customerId } };
}

function ArchiveMenu({ hasBalance, onArchive }: { hasBalance: boolean; onArchive: () => void }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          accessibilityLabel={t("customers.detail.moreActions")}
          size="icon"
          variant="outline"
        >
          <Icon as={Ellipsis} className="text-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" sideOffset={4}>
        <DropdownMenuItem disabled={hasBalance} onPress={onArchive} variant="destructive">
          <Icon as={Archive} className="text-destructive" size={15} />
          <View className="min-w-0 flex-1">
            <Text>{t("customers.detail.archive")}</Text>
            {hasBalance ? (
              <Text className="text-xs leading-4 text-muted-foreground">
                {t("customers.detail.archiveNeedsZeroBalance")}
              </Text>
            ) : null}
          </View>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
            canCharge && customer.status === "active" ? (
              <Link asChild href={newChargeHref(customer.id)}>
                <Button accessibilityRole="link" size="sm">
                  <Text>{t("customers.detail.newCharge")}</Text>
                </Button>
              </Link>
            ) : undefined
          }
          description={t("customers.detail.noReceivablesDescription")}
          icon={ReceiptText}
          title={t("customers.detail.noReceivablesTitle")}
        />
      ) : (
        <View className="gap-3">
          <ReceivablesTable caption={title} items={receivables.items} />
          {receivables.nextCursor ? (
            <View className="items-center">
              <Button
                label={t("customers.detail.loadMoreReceivables")}
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

export function CustomerDetailScreen({
  canCharge,
  canManage,
  onArchive,
  onLoadMoreReceivables,
  onRetry,
  state,
}: CustomerDetailScreenProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  if (state.kind !== "ready") {
    return <ScreenState kind={state.kind} onRetry={onRetry} skeleton="detail" />;
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

  return (
    <Page>
      <PageHeader
        actions={
          active && (canManage || canCharge) ? (
            <>
              {canManage ? (
                <Link asChild href={editHref}>
                  <Button accessibilityRole="link" variant="outline">
                    <Icon as={Pencil} className="text-foreground" size={15} />
                    <Text>{t("customers.detail.edit")}</Text>
                  </Button>
                </Link>
              ) : null}
              {canManage ? (
                <ArchiveMenu
                  hasBalance={isPositiveAmount(balance.outstandingMinorUnits)}
                  onArchive={onArchive}
                />
              ) : null}
              {canCharge ? (
                <Link asChild href={newChargeHref(customer.id)}>
                  <Button accessibilityRole="link">
                    <Icon as={Plus} className="text-primary-foreground" size={16} />
                    <Text>{t("customers.detail.newCharge")}</Text>
                  </Button>
                </Link>
              ) : null}
            </>
          ) : undefined
        }
        adornment={<CustomerStatusBadge status={customer.status} />}
        description={active ? undefined : t("customers.detail.archivedDescription")}
        title={customer.name}
      />
      {state.stale ? <StaleNotice onRetry={onRetry} /> : null}
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
        <DescriptionList
          items={[
            {
              label: t("customers.fields.phone"),
              value: customer.phone ?? <NotProvided />,
            },
            {
              label: t("customers.fields.email"),
              value: customer.email ?? <NotProvided />,
            },
            {
              label: t("customers.fields.notes"),
              value: customer.notes ?? <NotProvided />,
            },
          ]}
        />
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
