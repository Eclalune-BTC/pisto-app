import { AlertTriangle, ArrowLeft, Check, Plus, Search } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { Category } from "@pisto/contracts";

import type { CatalogStatusFilter } from "./query-keys";
import { ReadOnlyNotice } from "./route-state";

export type CategoryCollectionState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: Category[];
      loadingMore: boolean;
      stale?: boolean;
    };

export interface CategoryManagerCopy {
  back: string;
  title: string;
  description: string;
  create: string;
  searchLabel: string;
  searchPlaceholder: string;
  statuses: Record<CatalogStatusFilter, string>;
  loading: string;
  emptyTitle: string;
  emptyDescription: string;
  errorTitle: string;
  errorDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  offlineTitle: string;
  offlineDescription: string;
  stale: string;
  retry: string;
  loadMore: string;
  loadingMore: string;
  status: string;
  active: string;
  archived: string;
  edit: string;
  archive: string;
  name: string;
  namePlaceholder: string;
  nameValidation: string;
  createTitle: string;
  editTitle: string;
  reviewTitle: string;
  reviewCreateDescription: string;
  reviewEditDescription: string;
  review: string;
  confirmCreate: string;
  confirmUpdate: string;
  archiveTitle: string;
  archiveDescription: (name: string) => string;
  confirmArchive: string;
  failedTitle: string;
  uncertainTitle: string;
  uncertainDescription: string;
  resolveUncertain: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
}

export type CategoryEditorView = {
  error?: string;
  mode: "create" | "edit";
  mutationMessage?: string;
  mutationState: "error" | "idle" | "pending" | "uncertain";
  name: string;
  reviewName: string | null;
};

export type CategoryArchiveView = {
  category: Category;
  mutationMessage?: string;
  mutationState: "error" | "idle" | "pending" | "uncertain";
};

interface CategoryManagerProps {
  archiveView: CategoryArchiveView | null;
  canManage: boolean;
  copy: CategoryManagerCopy;
  editor: CategoryEditorView | null;
  onArchive: (category: Category) => void;
  onBack: () => void;
  onCancelArchive: () => void;
  onCancelEditor: () => void;
  onConfirmArchive: () => void;
  onConfirmEditor: () => void;
  onCreate: () => void;
  onEdit: (category: Category) => void;
  onEditReview: () => void;
  onLoadMore: () => void;
  onNameChange: (name: string) => void;
  onResolveArchive: () => void;
  onResolveEditor: () => void;
  onRetry: () => void;
  onReviewEditor: () => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: CatalogStatusFilter) => void;
  search: string;
  showReadOnlyNotice: boolean;
  state: CategoryCollectionState;
  status: CatalogStatusFilter;
}

function FailureNotice({ description, title }: { description: string; title: string }) {
  return (
    <View className="flex-row items-start gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
      <AlertTriangle color="#B94242" size={20} />
      <View className="min-w-0 flex-1 gap-1">
        <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
          {title}
        </Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">{description}</Text>
      </View>
    </View>
  );
}

function MutationFailure({
  copy,
  message,
  state,
}: {
  copy: CategoryManagerCopy;
  message?: string;
  state: "error" | "idle" | "pending" | "uncertain";
}) {
  if (state !== "error" && state !== "uncertain") return null;
  return (
    <FailureNotice
      description={
        state === "uncertain" ? copy.uncertainDescription : (message ?? copy.failedTitle)
      }
      title={state === "uncertain" ? copy.uncertainTitle : copy.failedTitle}
    />
  );
}

export function CategoryManager({
  archiveView,
  canManage,
  copy,
  editor,
  onArchive,
  onBack,
  onCancelArchive,
  onCancelEditor,
  onConfirmArchive,
  onConfirmEditor,
  onCreate,
  onEdit,
  onEditReview,
  onLoadMore,
  onNameChange,
  onResolveArchive,
  onResolveEditor,
  onRetry,
  onReviewEditor,
  onSearchChange,
  onStatusChange,
  search,
  showReadOnlyNotice,
  state,
  status,
}: CategoryManagerProps) {
  return (
    <Page contentContainerClassName="gap-8">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {copy.back}
        </ButtonText>
      </Button>
      <ScreenHeader
        action={
          canManage && !editor && !archiveView ? (
            <Button onPress={onCreate} variant="accent">
              <Plus color="#14241D" size={18} />
              <ButtonText variant="accent">{copy.create}</ButtonText>
            </Button>
          ) : undefined
        }
        description={copy.description}
        title={
          editor
            ? editor.reviewName
              ? copy.reviewTitle
              : editor.mode === "create"
                ? copy.createTitle
                : copy.editTitle
            : archiveView
              ? copy.archiveTitle
              : copy.title
        }
      />

      {showReadOnlyNotice && !editor && !archiveView ? (
        <ReadOnlyNotice description={copy.readOnlyDescription} />
      ) : null}

      {editor ? (
        editor.reviewName ? (
          <View className="gap-6">
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {editor.mode === "create" ? copy.reviewCreateDescription : copy.reviewEditDescription}
            </Text>
            <DetailList items={[{ label: copy.name, value: editor.reviewName }]} />
            <MutationFailure
              copy={copy}
              message={editor.mutationMessage}
              state={editor.mutationState}
            />
            <View className="gap-3 sm:flex-row">
              {editor.mutationState === "uncertain" ? (
                <Button
                  label={copy.resolveUncertain}
                  onPress={onResolveEditor}
                  variant="secondary"
                />
              ) : (
                <>
                  <Button
                    loading={editor.mutationState === "pending"}
                    onPress={onConfirmEditor}
                    variant="accent"
                  >
                    <Check color="#14241D" size={18} />
                    <ButtonText variant="accent">
                      {editor.mode === "create" ? copy.confirmCreate : copy.confirmUpdate}
                    </ButtonText>
                  </Button>
                  <Button label={copy.edit} onPress={onEditReview} variant="secondary" />
                </>
              )}
            </View>
          </View>
        ) : (
          <View className="gap-6 border-y border-line py-7 dark:border-[#304239]">
            <Field
              error={editor.error}
              label={copy.name}
              maxLength={80}
              onChangeText={onNameChange}
              placeholder={copy.namePlaceholder}
              value={editor.name}
            />
            <View className="gap-3 sm:flex-row">
              <Button label={copy.review} onPress={onReviewEditor} variant="accent" />
              <Button label={copy.back} onPress={onCancelEditor} variant="secondary" />
            </View>
          </View>
        )
      ) : archiveView ? (
        <View className="gap-6">
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {copy.archiveDescription(archiveView.category.name)}
          </Text>
          <DetailList
            items={[
              { label: copy.name, value: archiveView.category.name },
              { label: copy.status, value: copy.active },
            ]}
          />
          <MutationFailure
            copy={copy}
            message={archiveView.mutationMessage}
            state={archiveView.mutationState}
          />
          <View className="gap-3 sm:flex-row">
            {archiveView.mutationState === "uncertain" ? (
              <Button
                label={copy.resolveUncertain}
                onPress={onResolveArchive}
                variant="secondary"
              />
            ) : (
              <>
                <Button
                  label={copy.confirmArchive}
                  loading={archiveView.mutationState === "pending"}
                  onPress={onConfirmArchive}
                  variant="danger"
                />
                <Button label={copy.back} onPress={onCancelArchive} variant="secondary" />
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          <View className="gap-5 border-y border-line py-5 dark:border-[#304239] lg:flex-row lg:items-end lg:justify-between">
            <View className="min-w-0 flex-1 lg:max-w-[620px]">
              <Field
                label={copy.searchLabel}
                onChangeText={onSearchChange}
                placeholder={copy.searchPlaceholder}
                trailing={<Search color="#617168" size={18} />}
                value={search}
              />
            </View>
            <View accessibilityRole="tablist" className="flex-row flex-wrap gap-x-5 gap-y-1">
              {(["active", "archived", "all"] as const).map((value) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: status === value }}
                  className={status === value ? "border-b-2 border-positive py-2" : "py-2"}
                  key={value}
                  onPress={() => onStatusChange(value)}
                >
                  <Text className="font-semibold text-ink dark:text-white">
                    {copy.statuses[value]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {state.status === "loading" ? (
            <View className="min-h-56 items-start justify-center gap-3">
              <ActivityIndicator color="#237A55" />
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
            </View>
          ) : state.status === "offline" ? (
            <FailureNotice description={copy.offlineDescription} title={copy.offlineTitle} />
          ) : state.status === "denied" ? (
            <FailureNotice description={copy.deniedDescription} title={copy.deniedTitle} />
          ) : state.status === "error" ? (
            <View className="gap-4">
              <FailureNotice description={copy.errorDescription} title={copy.errorTitle} />
              <Button
                className="self-start"
                label={copy.retry}
                onPress={onRetry}
                variant="secondary"
              />
            </View>
          ) : state.items.length === 0 ? (
            <View className="gap-2 py-12">
              <Text className="text-xl font-black text-ink dark:text-white">{copy.emptyTitle}</Text>
              <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {copy.emptyDescription}
              </Text>
            </View>
          ) : (
            <View>
              {state.stale ? (
                <View className="mb-4 border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
                  <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
                </View>
              ) : null}
              {state.items.map((category) => (
                <View
                  className="gap-3 border-b border-line py-5 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
                  key={category.id}
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="text-lg font-black text-ink dark:text-white">
                      {category.name}
                    </Text>
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {category.status === "active" ? copy.active : copy.archived}
                    </Text>
                  </View>
                  {canManage && category.status === "active" ? (
                    <View className="gap-2 sm:flex-row">
                      <Button
                        label={copy.edit}
                        onPress={() => onEdit(category)}
                        size="sm"
                        variant="secondary"
                      />
                      <Button
                        label={copy.archive}
                        onPress={() => onArchive(category)}
                        size="sm"
                        variant="danger"
                      />
                    </View>
                  ) : null}
                </View>
              ))}
              {state.hasNextPage ? (
                <Button
                  className="mt-6 self-start"
                  label={state.loadingMore ? copy.loadingMore : copy.loadMore}
                  loading={state.loadingMore}
                  onPress={onLoadMore}
                  variant="secondary"
                />
              ) : null}
            </View>
          )}
        </>
      )}
    </Page>
  );
}
