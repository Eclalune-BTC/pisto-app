import type { CashAccount, CashMovement } from "@pisto/contracts";
import { Archive, ArrowLeftRight, Pencil } from "lucide-react-native";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Text } from "@/components/ui/text";
import type { MutationPhase } from "@/lib/mutation-phase";
import { CashMovementList } from "./cash-movement-list";
import {
  cashAccountKindLabels,
  cashAccountStatusLabels,
  cashBoundaryCopy,
  cashMovementActionLabels,
} from "./copy";
import { HeaderActions } from "./header-actions";
import { type CursorPage, LoadMoreButton } from "./load-more-button";

export type CashArchiveState = {
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onOpen: () => void;
  open: boolean;
  phase: MutationPhase;
  /** The control that opened the dialog; focus returns to it on close. */
  returnFocus: HTMLElement | null;
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
            <HeaderActions
              menuLabel={t("cash.accountDetail.moreActions")}
              overflow={[
                {
                  destructive: true,
                  icon: Archive,
                  label: t("cash.accountDetail.archive"),
                  onPress: archive.onOpen,
                },
              ]}
              primary={{
                href: {
                  pathname: "/operate/cash/adjustments/new",
                  params: { accountId: account.id },
                },
                label: t("cash.overview.adjust"),
              }}
              secondary={[
                {
                  href: {
                    pathname: "/operate/cash/accounts/[accountId]/edit",
                    params: { accountId: account.id },
                  },
                  icon: Pencil,
                  label: t("cash.accountDetail.edit"),
                },
                {
                  href: {
                    pathname: "/operate/cash/transfers/new",
                    params: { fromAccountId: account.id },
                  },
                  icon: ArrowLeftRight,
                  label: t("cash.overview.transfer"),
                },
              ]}
            />
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
      </StatGroup>

      <Section title={t("cash.accountDetail.detailsTitle")}>
        <DescriptionList
          items={[
            { label: t("cash.accountDetail.kind"), value: cashAccountKindLabels(t)[account.kind] },
            { label: t("cash.accountDetail.currency"), value: account.currency },
            {
              label: t("cash.accountDetail.negativePolicy"),
              value: account.allowNegativeBalance
                ? t("cash.accountDetail.negativeAllowed")
                : t("cash.accountDetail.negativeProtected"),
            },
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

      <Section
        description={t("cash.movements.order")}
        title={t("cash.accountDetail.movementsTitle")}
      >
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

      <ConfirmDialog
        uncertainDescription={t("cash.review.uncertainDescription")}
        confirmLabel={t("cash.accountDetail.archive")}
        description={t("cash.archive.description", {
          balance: formatMoney(
            account.balanceMinorUnits,
            account.currency,
            account.currencyMinorUnitDigits,
          ),
        })}
        destructive
        disabled={!canManage}
        errorMessage={archive.errorMessage}
        onCancel={archive.onCancel}
        onConfirm={archive.onConfirm}
        open={archive.open}
        phase={archive.phase}
        returnFocus={archive.returnFocus}
        title={t("cash.archive.title", { name: account.name })}
      />
    </Page>
  );
}
