import type { CashAccount, CashMovement } from "@pisto/contracts";
import { Link } from "expo-router";
import { ArrowLeftRight, Landmark, Plus, Scale } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FeatureBoundary, type FeatureRemoteState } from "@/components/feature-boundary";
import { HeaderActions } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { type CursorPage, LoadMoreButton } from "@/components/ui/load-more-button";
import { Text } from "@/components/ui/text";
import { CashAccountList } from "./cash-account-list";
import { CashAccountName } from "./cash-account-name";
import { CashMovementList } from "./cash-movement-list";
import { cashBoundaryCopy, cashMovementActionLabels } from "./copy";
import type { CashAccountStatusFilter } from "./search-params";

type CashScreenProps = {
  /** Names already loaded on this page, keyed by account. */
  accountNames: ReadonlyMap<string, string>;
  accountStatus: CashAccountStatusFilter;
  accounts: CashAccount[];
  accountsPage: CursorPage;
  accountsState: FeatureRemoteState;
  businessId: string;
  /** Manager access confirmed by fresh reads. */
  canManage: boolean;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatOccurredAt: (movement: CashMovement) => string;
  isStale: boolean;
  movements: CashMovement[];
  movementsPage: CursorPage;
  movementsState: FeatureRemoteState;
  onAccountStatusChange: (status: CashAccountStatusFilter) => void;
  onOpenMovement: (movementId: string) => void;
  onRetry: () => void;
};

export function CashScreen({
  accountNames,
  accountStatus,
  accounts,
  accountsPage,
  accountsState,
  businessId,
  canManage,
  formatMoney,
  formatOccurredAt,
  isStale,
  movements,
  movementsPage,
  movementsState,
  onAccountStatusChange,
  onOpenMovement,
  onRetry,
}: CashScreenProps) {
  const { t } = useTranslation();
  const boundary = cashBoundaryCopy(t);
  return (
    <Page>
      <PageHeader
        actions={
          canManage ? (
            <HeaderActions
              menuLabel={t("cash.overview.moreActions")}
              primary={{
                href: "/operate/cash/accounts/new",
                icon: Plus,
                label: t("cash.overview.newAccount"),
              }}
              secondary={[
                {
                  href: "/operate/cash/adjustments/new",
                  icon: Scale,
                  label: t("cash.overview.adjust"),
                },
                {
                  href: "/operate/cash/transfers/new",
                  icon: ArrowLeftRight,
                  label: t("cash.overview.transfer"),
                },
              ]}
            />
          ) : undefined
        }
        description={t("cash.overview.description")}
        title={t("cash.overview.title")}
      />

      {isStale ? <StaleNotice onRetry={onRetry} /> : null}

      <Section
        actions={
          <FilterBar
            label={t("cash.overview.statusFilter")}
            onChange={onAccountStatusChange}
            options={[
              { label: t("cash.overview.statusOptions.active"), value: "active" },
              { label: t("cash.overview.statusOptions.archived"), value: "archived" },
              { label: t("cash.overview.statusOptions.all"), value: "all" },
            ]}
            value={accountStatus}
          />
        }
        title={t("cash.overview.accountsTitle")}
      >
        <FeatureBoundary
          copy={{ ...boundary, unavailableTitle: t("cash.overview.accountsUnavailable") }}
          inline
          onRetry={onRetry}
          state={accountsState}
        >
          <View className="min-w-0 gap-3">
            <CashAccountList
              accounts={accounts}
              empty={
                <EmptyState
                  action={
                    canManage && accountStatus !== "archived" ? (
                      <Link asChild href="/operate/cash/accounts/new">
                        <Button accessibilityRole="link" size="sm">
                          <Text>{t("cash.overview.newAccount")}</Text>
                        </Button>
                      </Link>
                    ) : undefined
                  }
                  description={
                    accountStatus === "archived"
                      ? t("cash.overview.emptyArchivedDescription")
                      : t("cash.overview.emptyDescription")
                  }
                  icon={Landmark}
                  title={t(`cash.overview.emptyTitle.${accountStatus}`)}
                />
              }
              formatMoney={formatMoney}
            />
            <LoadMoreButton page={accountsPage} />
          </View>
        </FeatureBoundary>
      </Section>

      <Section
        description={t("cash.overview.movementsDescription")}
        title={t("cash.overview.movementsTitle")}
      >
        <FeatureBoundary
          copy={{ ...boundary, unavailableTitle: t("cash.overview.movementsUnavailable") }}
          inline
          onRetry={onRetry}
          state={movementsState}
        >
          <View className="min-w-0 gap-3">
            <CashMovementList
              actionLabels={cashMovementActionLabels(t)}
              formatMoney={formatMoney}
              formatOccurredAt={formatOccurredAt}
              movements={movements}
              noMovements={t("cash.overview.noMovements")}
              onOpenMovement={onOpenMovement}
              renderAccount={(movement) => (
                <CashAccountName
                  accountId={movement.accountId}
                  businessId={businessId}
                  className="text-muted-foreground"
                  knownName={accountNames.get(movement.accountId)}
                />
              )}
            />
            <LoadMoreButton page={movementsPage} />
          </View>
        </FeatureBoundary>
      </Section>
    </Page>
  );
}
