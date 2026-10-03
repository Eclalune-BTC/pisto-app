import type { CashAccountStatus, CashMovementAction } from "@pisto/contracts";
import { AlertTriangle } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { CashAccountList } from "./cash-account-list";
import { CashMovementList } from "./cash-movement-list";
import { FeatureBoundary } from "./feature-boundary";
import { type CashScreenState, cashScreenPresentation } from "./state";

export type { CashConfirmationState, CashScreenState } from "./state";

export type CashScreenCopy = {
  title: string;
  description: string;
  eyebrow: string;
  loading: string;
  retry: string;
  deniedTitle: string;
  offlineTitle: string;
  deniedDescription: string;
  unavailableTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  createAccount: string;
  accountsTitle: string;
  movementsTitle: string;
  noMovements: string;
  active: string;
  archived: string;
  negativeAllowed: string;
  mutationFailedTitle: string;
  uncertainTitle: string;
  uncertainDescription: string;
  retrySameConfirmation: string;
  movementActions: Record<CashMovementAction, string>;
  accountFilter: string;
  activeAccounts: string;
  archivedAccounts: string;
  allAccounts: string;
  loadMore: string;
  loadingMore: string;
};

type CashScreenProps = {
  state: CashScreenState;
  accountStatus: CashAccountStatus | "all";
  hasMoreAccounts: boolean;
  hasMoreMovements: boolean;
  isLoadingMoreAccounts: boolean;
  isLoadingMoreMovements: boolean;
  copy: CashScreenCopy;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onCreateAccount: () => void;
  onOpenAccount: (accountId: string) => void;
  onRetry: () => void;
  onCheckMutationStatus: () => void;
  onAccountStatusChange: (status: CashAccountStatus | "all") => void;
  onLoadMoreAccounts: () => void;
  onLoadMoreMovements: () => void;
};

export function CashScreen({
  state,
  accountStatus,
  hasMoreAccounts,
  hasMoreMovements,
  isLoadingMoreAccounts,
  isLoadingMoreMovements,
  copy,
  formatMoney,
  onCreateAccount,
  onOpenAccount,
  onRetry,
  onCheckMutationStatus,
  onAccountStatusChange,
  onLoadMoreAccounts,
  onLoadMoreMovements,
}: CashScreenProps) {
  const presentation = cashScreenPresentation(state);
  const { t } = useTranslation();
  const [view, setView] = useState<"accounts" | "movements">("accounts");
  return (
    <Page contentContainerClassName="gap-6">
      <ScreenHeader
        action={
          presentation.showCreate ? (
            <Button label={copy.createAccount} onPress={onCreateAccount} variant="default" />
          ) : undefined
        }
        description={state.kind === "denied" ? copy.deniedDescription : copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />
      {state.kind === "ready" && state.isStale ? <StaleNotice /> : null}
      {state.kind === "ready" && state.confirmation === "uncertain" ? (
        <Alert icon={AlertTriangle}>
          <AlertTitle className="leading-6">{copy.uncertainTitle}</AlertTitle>
          <AlertDescription>{copy.uncertainDescription}</AlertDescription>
          <Button
            className="mb-2 ml-6 mt-2 self-start"
            label={copy.retrySameConfirmation}
            onPress={onCheckMutationStatus}
            variant="outline"
          />
        </Alert>
      ) : state.kind === "ready" && state.confirmation === "failed" ? (
        <Alert icon={AlertTriangle} variant="destructive">
          <AlertTitle className="leading-6">{copy.mutationFailedTitle}</AlertTitle>
          {state.mutationMessage ? (
            <AlertDescription>{state.mutationMessage}</AlertDescription>
          ) : null}
          <Button
            className="mb-2 ml-6 mt-2 self-start"
            label={copy.retry}
            onPress={onRetry}
            variant="outline"
          />
        </Alert>
      ) : null}
      {state.kind === "denied" ? (
        <FeatureBoundary copy={copy} inline onRetry={onRetry} state={state}>
          {null}
        </FeatureBoundary>
      ) : (
        <WorkspaceTabs
          label={t("filters.views")}
          value={view}
          onChange={setView}
          items={[
            {
              value: "accounts",
              label: t("filters.accounts"),
              content: (
                <>
                  <FilterToolbar
                    label={copy.accountFilter}
                    onReset={
                      accountStatus !== "active" ? () => onAccountStatusChange("active") : undefined
                    }
                    resetLabel={t("filters.reset")}
                  >
                    <FilterBar
                      showLabel
                      label={copy.accountFilter}
                      onChange={onAccountStatusChange}
                      options={[
                        { label: copy.activeAccounts, value: "active" },
                        { label: copy.archivedAccounts, value: "archived" },
                        { label: copy.allAccounts, value: "all" },
                      ]}
                      value={accountStatus}
                    />
                  </FilterToolbar>
                  <FeatureBoundary copy={copy} inline onRetry={onRetry} state={state}>
                    {state.kind === "ready" ? (
                      <View className="min-w-0 gap-4">
                        {state.accounts.length === 0 ? (
                          <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
                        ) : (
                          <CashAccountList
                            accounts={state.accounts}
                            activeLabel={copy.active}
                            archivedLabel={copy.archived}
                            formatMoney={formatMoney}
                            negativeAllowedLabel={copy.negativeAllowed}
                            onOpenAccount={onOpenAccount}
                          />
                        )}
                        {hasMoreAccounts ? (
                          <Button
                            className="self-start"
                            label={isLoadingMoreAccounts ? copy.loadingMore : copy.loadMore}
                            loading={isLoadingMoreAccounts}
                            onPress={onLoadMoreAccounts}
                            variant="outline"
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </FeatureBoundary>
                </>
              ),
            },
            {
              value: "movements",
              label: t("filters.movements"),
              content: (
                <FeatureBoundary copy={copy} inline onRetry={onRetry} state={state}>
                  {state.kind === "ready" ? (
                    <View className="min-w-0 gap-4">
                      <CashMovementList
                        actionLabels={copy.movementActions}
                        formatMoney={formatMoney}
                        movements={state.movements}
                        noMovements={copy.noMovements}
                      />
                      {hasMoreMovements ? (
                        <Button
                          className="self-start"
                          label={isLoadingMoreMovements ? copy.loadingMore : copy.loadMore}
                          loading={isLoadingMoreMovements}
                          onPress={onLoadMoreMovements}
                          variant="outline"
                        />
                      ) : null}
                    </View>
                  ) : null}
                </FeatureBoundary>
              ),
            },
          ]}
        />
      )}
    </Page>
  );
}
