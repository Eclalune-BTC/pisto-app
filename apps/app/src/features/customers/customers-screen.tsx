import { ChevronRight, Plus, RefreshCw, Search } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import type { CustomersCopy, CustomersLoadState } from "./types";

type CustomersScreenProps = {
  canManage: boolean;
  copy: CustomersCopy;
  onCreate: () => void;
  onLoadMore: () => void;
  onOpenCustomer: (customerId: string) => void;
  onRetry: () => void;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: CustomerStatusFilter) => void;
  searchQuery: string;
  state: CustomersLoadState;
  status: CustomerStatusFilter;
};

export type CustomerStatusFilter = "active" | "archived" | "all";

function StateMessage({
  action,
  description,
  title,
}: {
  action?: { label: string; onPress: () => void };
  description: string;
  title: string;
}) {
  return (
    <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
      <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
        {title}
      </Text>
      <Text className="max-w-[540px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {description}
      </Text>
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

export function CustomersScreen({
  canManage,
  copy,
  onCreate,
  onLoadMore,
  onOpenCustomer,
  onRetry,
  onSearchChange,
  onStatusChange,
  searchQuery,
  state,
  status,
}: CustomersScreenProps) {
  const hasSuccessfulRead = state.kind === "empty" || state.kind === "ready";
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader
        action={
          canManage && hasSuccessfulRead ? (
            <Button onPress={onCreate} variant="accent">
              <Plus color="#14241D" size={18} />
              <ButtonText variant="accent">{copy.create}</ButtonText>
            </Button>
          ) : undefined
        }
        description={copy.description}
        title={copy.title}
      />

      {hasSuccessfulRead ? (
        <View className="gap-5">
          <View className="max-w-[620px]">
            <Field
              accessibilityLabel={copy.searchLabel}
              label={copy.searchLabel}
              onChangeText={onSearchChange}
              placeholder={copy.searchPlaceholder}
              trailing={<Search color="#617168" size={18} />}
              value={searchQuery}
            />
          </View>
          <View
            accessibilityLabel={copy.filterLabel}
            className="flex-row flex-wrap border-b border-line dark:border-[#304239]"
          >
            {(
              [
                ["active", copy.active],
                ["archived", copy.archived],
                ["all", copy.all],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: status === value }}
                className={`min-h-11 justify-center border-b-2 px-4 ${
                  status === value ? "border-positive" : "border-transparent"
                }`}
                key={value}
                onPress={() => onStatusChange(value)}
              >
                <Text
                  className={`text-sm font-bold ${
                    status === value
                      ? "text-positive dark:text-[#8DDEAF]"
                      : "text-ink-muted dark:text-[#AAB8B0]"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {hasSuccessfulRead && state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
        </View>
      ) : null}

      {state.kind === "loading" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line dark:border-[#304239]">
          <ActivityIndicator color="#237A55" />
          <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
            {copy.loading}
          </Text>
        </View>
      ) : state.kind === "offline" ? (
        <StateMessage description={copy.offlineDescription} title={copy.offlineTitle} />
      ) : state.kind === "denied" ? (
        <StateMessage description={copy.deniedDescription} title={copy.deniedTitle} />
      ) : state.kind === "error" ? (
        <StateMessage
          action={{ label: copy.retry, onPress: onRetry }}
          description={copy.errorDescription}
          title={copy.errorTitle}
        />
      ) : state.kind === "empty" ? (
        <StateMessage
          action={
            canManage && !searchQuery ? { label: copy.emptyAction, onPress: onCreate } : undefined
          }
          description={searchQuery ? copy.searchEmptyDescription : copy.emptyDescription}
          title={searchQuery ? copy.searchEmptyTitle : copy.emptyTitle}
        />
      ) : (
        <View className="gap-4">
          <View className="border-t border-line dark:border-[#304239]">
            {state.items.map((item) => {
              const contact = item.email ?? item.phone;
              return (
                <Pressable
                  accessibilityHint={copy.contact}
                  accessibilityRole="button"
                  className="min-h-16 flex-row items-center gap-4 border-b border-line py-4 active:opacity-70 dark:border-[#304239]"
                  key={item.id}
                  onPress={() => onOpenCustomer(item.id)}
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-base font-bold text-ink dark:text-white">
                      {item.name}
                    </Text>
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {contact ?? copy.noContact}
                    </Text>
                  </View>
                  {item.status === "archived" ? (
                    <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
                      {copy.archived}
                    </Text>
                  ) : null}
                  <ChevronRight color="#617168" size={19} />
                </Pressable>
              );
            })}
          </View>
          {state.nextCursor ? (
            <Button disabled={state.loadingMore} onPress={onLoadMore} variant="secondary">
              {state.loadingMore ? (
                <ActivityIndicator color="#14241D" />
              ) : (
                <>
                  <RefreshCw color="#14241D" size={17} />
                  <ButtonText variant="secondary">{copy.loadMore}</ButtonText>
                </>
              )}
            </Button>
          ) : null}
        </View>
      )}
    </Page>
  );
}
