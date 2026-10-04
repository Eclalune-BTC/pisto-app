import type { CashAccount, CashMovement } from "@pisto/contracts";
import { Link } from "expo-router";
import { Archive, Ellipsis } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FeatureBoundary, type FeatureRemoteState } from "@/components/feature-boundary";
import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { CashMovementList } from "./cash-movement-list";
import { ConfirmCommandDialog } from "./confirm-command-dialog";
import {
  cashAccountKindLabels,
  cashAccountStatusLabels,
  cashBoundaryCopy,
  cashMovementActionLabels,
} from "./copy";
import { type CursorPage, LoadMoreButton } from "./load-more-button";
import type { MutationPhase } from "./mutation-state";

export type CashArchiveState = {
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onOpen: () => void;
  open: boolean;
  phase: MutationPhase;
};

type CashAccountDetailScreenProps = {
  account: CashAccount;
  archive: CashArchiveState;
  /** Manager access confirmed by fresh reads. */
  canManage: boolean;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatOccurredAt: (movement: CashMovement) => string;
  formatTimestamp: (timestamp: string) => string;
  isStale: boolean;
  movements: CashMovement[];
  movementsPage: CursorPage;
  movementsState: FeatureRemoteState;
  onOpenMovement: (movementId: string) => void;
  onRetry: () => void;
};

export function CashAccountDetailScreen({
  account,
  archive,
  canManage,
  formatMoney,
  formatOccurredAt,
  formatTimestamp,
  isStale,
  movements,
  movementsPage,
  movementsState,
  onOpenMovement,
  onRetry,
}: CashAccountDetailScreenProps) {
  const { t } = useTranslation();
  const active = account.status === "active";
  const negative = account.balanceMinorUnits.startsWith("-");
  return (
    <Page>
      <PageHeader
        actions={
          canManage && active ? (
            <>
              <Link
                asChild
                href={{
                  pathname: "/operate/cash/accounts/[accountId]/edit",
                  params: { accountId: account.id },
                }}
              >
                <Button accessibilityRole="link" variant="outline">
                  <Text>{t("cash.accountDetail.edit")}</Text>
                </Button>
              </Link>
              <Link
                asChild
                href={{
                  pathname: "/operate/cash/transfers/new",
                  params: { fromAccountId: account.id },
                }}
              >
                <Button accessibilityRole="link" variant="outline">
                  <Text>{t("cash.overview.transfer")}</Text>
                </Button>
              </Link>
              <Link
                asChild
                href={{
                  pathname: "/operate/cash/adjustments/new",
                  params: { accountId: account.id },
                }}
              >
                <Button accessibilityRole="link">
                  <Text>{t("cash.overview.adjust")}</Text>
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    accessibilityLabel={t("cash.accountDetail.moreActions")}
                    size="icon"
                    variant="outline"
                  >
                    <Icon as={Ellipsis} className="text-foreground" size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44" sideOffset={4}>
                  <DropdownMenuItem onPress={archive.onOpen} variant="destructive">
                    <Icon as={Archive} className="text-destructive" size={15} />
                    <Text>{t("cash.accountDetail.archive")}</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : undefined
        }
        adornment={
          <Badge variant={active ? "secondary" : "outline"}>
            <Text>{cashAccountStatusLabels(t)[account.status]}</Text>
          </Badge>
        }
        title={account.name}
      />

      {isStale ? <StaleNotice onRetry={onRetry} /> : null}

      <StatGroup>
        <Stat
          detail={t("cash.accountDetail.balanceDetail")}
          label={t("cash.accountDetail.balance")}
          tone={negative ? "destructive" : "default"}
          value={formatMoney(
            account.balanceMinorUnits,
            account.currency,
            account.currencyMinorUnitDigits,
          )}
        />
        <Stat
          detail={
            account.allowNegativeBalance
              ? t("cash.accountDetail.negativeAllowedDetail")
              : t("cash.accountDetail.negativeProtectedDetail")
          }
          label={t("cash.accountDetail.negativePolicy")}
          value={
            account.allowNegativeBalance
              ? t("cash.accountDetail.negativeAllowed")
              : t("cash.accountDetail.negativeProtected")
          }
        />
      </StatGroup>

      <Section title={t("cash.accountDetail.detailsTitle")}>
        <DescriptionList
          items={[
            { label: t("cash.accountDetail.kind"), value: cashAccountKindLabels(t)[account.kind] },
            { label: t("cash.accountDetail.currency"), value: account.currency },
            {
              label: t("cash.accountDetail.createdAt"),
              numeric: true,
              value: formatTimestamp(account.createdAt),
            },
            {
              label: t("cash.accountDetail.updatedAt"),
              numeric: true,
              value: formatTimestamp(account.updatedAt),
            },
          ]}
        />
      </Section>

      <Section title={t("cash.accountDetail.movementsTitle")}>
        <FeatureBoundary
          copy={{
            ...cashBoundaryCopy(t),
            unavailableTitle: t("cash.overview.movementsUnavailable"),
          }}
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
              noMovements={t("cash.accountDetail.noMovements")}
              onOpenMovement={onOpenMovement}
            />
            <LoadMoreButton page={movementsPage} />
          </View>
        </FeatureBoundary>
      </Section>

      <ConfirmCommandDialog
        confirmLabel={t("cash.accountDetail.archive")}
        description={t("cash.archive.description")}
        destructive
        disabled={!canManage}
        errorMessage={archive.errorMessage}
        onCancel={archive.onCancel}
        onConfirm={archive.onConfirm}
        open={archive.open}
        phase={archive.phase}
        title={t("cash.archive.title", { name: account.name })}
      />
    </Page>
  );
}
