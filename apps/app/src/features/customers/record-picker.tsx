import { Check, Lock, TriangleAlert, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View } from "react-native";

import { StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import type { FocusReturnRef } from "./focus-return";
import type { ReadState } from "./read-state";
import { SearchField } from "./search-field";

export type PickerStatus = "denied" | "error" | "loading" | "offline" | "ready";

export function pickerStatus(read: ReadState): PickerStatus {
  return read.kind === "notFound" ? "error" : read.kind;
}

export type RecordPickerListProps<T> = {
  emptyText: string;
  /** A choice becomes part of a command, so it can only be made from a fresh read. */
  freshChoiceOnly: boolean;
  getKey: (item: T) => string;
  hasNextPage: boolean;
  items: readonly T[];
  label: string;
  loadMoreLabel: string;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (item: T) => void;
  /** `tag` marks a choice that differs from the rest, such as an archived record. */
  renderItem: (item: T) => { detail?: string; label: string; tag?: string };
  selectedKey: string | null;
  /** The choices are cached and could not be refreshed. */
  stale: boolean;
  status: PickerStatus;
};

/** The choices of a picker: a single-choice list whose server cursor stays inside the list. */
export function RecordPickerList<T>({
  emptyText,
  freshChoiceOnly,
  getKey,
  hasNextPage,
  items,
  label,
  loadMoreLabel,
  loadingMore,
  onLoadMore,
  onRetry,
  onSelect,
  renderItem,
  selectedKey,
  stale,
  status,
}: RecordPickerListProps<T>) {
  const { t } = useTranslation();
  if (status === "loading") {
    return (
      <View
        accessibilityLabel={t("common.loadingContent")}
        aria-busy
        className="overflow-hidden rounded-md border border-border"
      >
        {[0, 1, 2, 3].map((index) => (
          <View
            className={cn("gap-1.5 px-3 py-2.5", index > 0 && "border-t border-border")}
            key={index}
          >
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-24" />
          </View>
        ))}
      </View>
    );
  }
  if (status === "offline") {
    return (
      <Alert icon={WifiOff}>
        <AlertDescription>{t("remote.offlineDescription")}</AlertDescription>
      </Alert>
    );
  }
  if (status === "denied") {
    return (
      <Alert icon={Lock}>
        <AlertDescription>{t("relationships.access.deniedDescription")}</AlertDescription>
      </Alert>
    );
  }
  if (status === "error") {
    return (
      <Alert
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        icon={TriangleAlert}
        variant="destructive"
      >
        <AlertDescription>{t("relationships.picker.unavailable")}</AlertDescription>
      </Alert>
    );
  }
  if (items.length === 0) {
    return <Text className="py-6 text-center text-sm text-muted-foreground">{emptyText}</Text>;
  }
  const blocked = stale && freshChoiceOnly;
  return (
    <>
      {stale ? <StaleNotice onRetry={onRetry} /> : null}
      <ScrollView
        className="max-h-80 rounded-md border border-border"
        keyboardShouldPersistTaps="handled"
      >
        <View accessibilityLabel={label} role="radiogroup">
          {items.map((item, index) => {
            const key = getKey(item);
            const selected = key === selectedKey;
            const content = renderItem(item);
            return (
              <PressableSurface
                accessibilityLabel={
                  [content.label, content.tag, content.detail].filter(Boolean).join(", ") ||
                  undefined
                }
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: blocked }}
                className={cn(
                  "min-h-11 flex-row items-center gap-3 px-3 py-2",
                  // The list clips an outside focus ring, so the ring is drawn inside the option.
                  Platform.select({
                    web: "focus-visible:bg-accent focus-visible:-outline-offset-2",
                  }),
                  index > 0 && "border-t border-border",
                  selected && "bg-accent",
                )}
                disabled={blocked}
                key={key}
                onPress={() => onSelect(item)}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm leading-5" numberOfLines={1}>
                    {content.label}
                  </Text>
                  {content.detail ? (
                    <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
                      {content.detail}
                    </Text>
                  ) : null}
                </View>
                {content.tag ? (
                  <Badge variant="outline">
                    <Text>{content.tag}</Text>
                  </Badge>
                ) : null}
                {selected ? <Icon as={Check} className="text-foreground" size={15} /> : null}
              </PressableSurface>
            );
          })}
        </View>
        {hasNextPage ? (
          <View className="border-t border-border p-1.5">
            <Button
              className="w-full"
              label={loadMoreLabel}
              loading={loadingMore}
              onPress={onLoadMore}
              size="sm"
              variant="ghost"
            />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

type RecordPickerProps<T> = RecordPickerListProps<T> & {
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The control that opened the picker; focus returns to it when the picker closes. */
  returnFocusRef?: FocusReturnRef;
  search?: {
    /** A typed search that is not applied yet or is still being read. */
    busy: boolean;
    label: string;
    maxLength: number;
    onChange: (value: string) => void;
    placeholder: string;
    value: string;
  };
  title: string;
};

/** Chooses one record in a dialog, so a form keeps its place instead of being replaced. */
export function RecordPicker<T>({
  description,
  onOpenChange,
  open,
  returnFocusRef,
  search,
  title,
  ...list
}: RecordPickerProps<T>) {
  const { t } = useTranslation();
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        // A fixed width keeps the dialog still while results narrow.
        className="gap-3 p-4 sm:max-w-md web:w-[28rem]"
        onCloseAutoFocus={(event) => {
          // Opened without a trigger, the dialog would otherwise return focus to the page body.
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {search ? (
          <SearchField
            autoFocus
            busy={search.busy}
            clearLabel={t("relationships.common.clearSearch")}
            label={search.label}
            maxLength={search.maxLength}
            onChangeText={search.onChange}
            placeholder={search.placeholder}
            value={search.value}
          />
        ) : null}
        <RecordPickerList {...list} />
      </DialogContent>
    </Dialog>
  );
}
