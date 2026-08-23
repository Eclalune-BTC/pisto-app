import type { CashAccountStatus, CashMovementAction } from "@pisto/contracts";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { CashAccountList } from "./cash-account-list";
import { CashMovementList } from "./cash-movement-list";
import { ChoiceList } from "./choice-list";
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

function StateMessage({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
      <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
        {title}
      </Text>
      <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {description}
      </Text>
      {action}
    </View>
  );
}

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
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {copy.loading}
        </Text>
      </View>
    );
  }

  if (state.kind === "denied") {
    return (
      <Page>
        <StateMessage description={copy.deniedDescription} title={copy.deniedTitle} />
      </Page>
    );
  }

  if (state.kind === "offline" || state.kind === "error") {
    return (
      <Page>
        <StateMessage
          action={<Button label={copy.retry} onPress={onRetry} variant="secondary" />}
          description={state.message}
          title={state.kind === "offline" ? copy.offlineTitle : copy.unavailableTitle}
        />
      </Page>
    );
  }

  const presentation = cashScreenPresentation(state);
  return (
    <Page contentContainerClassName="gap-9">
      <ScreenHeader
        action={
          presentation.showCreate ? (
            <Button label={copy.createAccount} onPress={onCreateAccount} variant="accent" />
          ) : undefined
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      {state.isStale ? <StaleNotice /> : null}

      <View className="max-w-[560px] border-y border-line py-5 dark:border-[#304239]">
        <ChoiceList
          label={copy.accountFilter}
          onChange={onAccountStatusChange}
          options={[
            { label: copy.activeAccounts, value: "active" },
            { label: copy.archivedAccounts, value: "archived" },
            { label: copy.allAccounts, value: "all" },
          ]}
          value={accountStatus}
        />
      </View>

      {state.confirmation === "uncertain" ? (
        <View className="gap-3 border-l-4 border-warning bg-[#FFF6E8] p-4 dark:bg-[#3A2A18]">
          <Text accessibilityRole="alert" className="font-bold text-ink dark:text-[#F2E4D2]">
            {copy.uncertainTitle}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#D7C7B4]">
            {copy.uncertainDescription}
          </Text>
          <Button
            className="self-start"
            label={copy.retrySameConfirmation}
            onPress={onCheckMutationStatus}
            variant="secondary"
          />
        </View>
      ) : state.confirmation === "failed" ? (
        <View className="gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
          <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
            {copy.mutationFailedTitle}
          </Text>
          {state.mutationMessage ? (
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
              {state.mutationMessage}
            </Text>
          ) : null}
          <Button className="self-start" label={copy.retry} onPress={onRetry} variant="secondary" />
        </View>
      ) : null}

      {state.accounts.length === 0 ? (
        <StateMessage
          action={
            presentation.showCreate ? (
              <Button label={copy.createAccount} onPress={onCreateAccount} variant="accent" />
            ) : undefined
          }
          description={copy.emptyDescription}
          title={copy.emptyTitle}
        />
      ) : (
        <View className="gap-4">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {copy.accountsTitle}
          </Text>
          <CashAccountList
            accounts={state.accounts}
            activeLabel={copy.active}
            archivedLabel={copy.archived}
            formatMoney={formatMoney}
            negativeAllowedLabel={copy.negativeAllowed}
            onOpenAccount={onOpenAccount}
          />
          {hasMoreAccounts ? (
            <Button
              className="self-start"
              label={isLoadingMoreAccounts ? copy.loadingMore : copy.loadMore}
              loading={isLoadingMoreAccounts}
              onPress={onLoadMoreAccounts}
              variant="secondary"
            />
          ) : null}
        </View>
      )}

      <View className="gap-4">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {copy.movementsTitle}
        </Text>
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
            variant="secondary"
          />
        ) : null}
      </View>
    </Page>
  );
}
