import type { Category } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Search } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";

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
  retrySameConfirmation: string;
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
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  return (
    <View className="flex-row items-start gap-3 border-l-4 border-destructive bg-muted p-4">
      <AlertTriangle color={destructiveColor} size={20} />
      <View className="min-w-0 flex-1 gap-1">
        <Text accessibilityRole="alert" className="font-ui text-destructive">
          {title}
        </Text>
        <Text className="font-sans text-sm leading-5 text-muted-foreground">{description}</Text>
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
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<Category>[]>(
    () => [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({ row: { original: category } }) => (
          <Text className="font-ui text-sm text-foreground">{category.name}</Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original: category } }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {category.status === "active" ? copy.active : copy.archived}
          </Text>
        ),
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: t("dataTable.columns.actions"),
              cell: ({ row: { original: category } }) =>
                category.status === "active" ? (
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      label={copy.edit}
                      onPress={() => onEdit(category)}
                      size="sm"
                      variant="outline"
                    />
                    <Button
                      label={copy.archive}
                      onPress={() => onArchive(category)}
                      size="sm"
                      variant="destructive"
                    />
                  </View>
                ) : null,
            } satisfies DataTableColumn<Category>,
          ]
        : []),
    ],
    [canManage, copy, onArchive, onEdit, t],
  );
  const mutationState = editor?.mutationState ?? archiveView?.mutationState;
  const confirmationLocked = mutationState === "pending" || mutationState === "uncertain";
  if (state.status === "denied") {
    return (
      <Page>
        <FailureNotice description={copy.deniedDescription} title={copy.deniedTitle} />
      </Page>
    );
  }
  return (
    <Page contentContainerClassName="gap-8">
      <Button
        className="self-start px-0"
        disabled={confirmationLocked}
        onPress={confirmationLocked ? undefined : onBack}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color={mutedColor} size={18} />
        <Text className="text-muted-foreground">{copy.back}</Text>
      </Button>
      <ScreenHeader
        action={
          canManage && !editor && !archiveView ? (
            <Button label={copy.create} onPress={onCreate} variant="default" />
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
            <Text className="font-sans text-sm leading-5 text-muted-foreground">
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
                  label={copy.retrySameConfirmation}
                  onPress={onResolveEditor}
                  variant="outline"
                />
              ) : (
                <>
                  <Button
                    loading={editor.mutationState === "pending"}
                    onPress={onConfirmEditor}
                    variant="default"
                  >
                    <Text>
                      {editor.mode === "create" ? copy.confirmCreate : copy.confirmUpdate}
                    </Text>
                  </Button>
                  <Button
                    disabled={editor.mutationState === "pending"}
                    label={copy.edit}
                    onPress={editor.mutationState === "pending" ? undefined : onEditReview}
                    variant="outline"
                  />
                </>
              )}
            </View>
          </View>
        ) : (
          <View className="gap-6 border-y border-border py-7">
            <Field
              error={editor.error}
              label={copy.name}
              maxLength={80}
              onChangeText={onNameChange}
              placeholder={copy.namePlaceholder}
              value={editor.name}
            />
            <View className="gap-3 sm:flex-row">
              <Button label={copy.review} onPress={onReviewEditor} variant="default" />
              <Button label={copy.back} onPress={onCancelEditor} variant="outline" />
            </View>
          </View>
        )
      ) : archiveView ? (
        <View className="gap-6">
          <Text className="font-sans text-sm leading-5 text-muted-foreground">
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
                label={copy.retrySameConfirmation}
                onPress={onResolveArchive}
                variant="outline"
              />
            ) : (
              <>
                <Button
                  label={copy.confirmArchive}
                  loading={archiveView.mutationState === "pending"}
                  onPress={onConfirmArchive}
                  variant="destructive"
                />
                <Button
                  disabled={archiveView.mutationState === "pending"}
                  label={copy.back}
                  onPress={archiveView.mutationState === "pending" ? undefined : onCancelArchive}
                  variant="outline"
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          <FilterToolbar label={copy.status}>
            <View className="min-w-0 flex-1 lg:max-w-[620px]">
              <Field
                label={copy.searchLabel}
                onChangeText={onSearchChange}
                placeholder={copy.searchPlaceholder}
                trailing={<Search color={mutedColor} size={18} />}
                value={search}
              />
            </View>
            <FilterBar
              label={copy.status}
              onChange={onStatusChange}
              options={(["active", "archived", "all"] as const).map((value) => ({
                label: copy.statuses[value],
                value,
              }))}
              value={status}
            />
          </FilterToolbar>

          {state.status === "ready" && state.stale ? (
            <View className="border-l-4 border-warning bg-muted p-3">
              <Text className="font-sans text-sm text-foreground">{copy.stale}</Text>
            </View>
          ) : null}
          {state.status === "loading" ? (
            <View className="min-h-56 items-start justify-center gap-3">
              <LoadingIndicator />
              <Text className="font-sans text-sm text-muted-foreground">{copy.loading}</Text>
            </View>
          ) : state.status === "offline" ? (
            <FailureNotice description={copy.offlineDescription} title={copy.offlineTitle} />
          ) : state.status === "error" ? (
            <View className="gap-4">
              <FailureNotice description={copy.errorDescription} title={copy.errorTitle} />
              <Button
                className="self-start"
                label={copy.retry}
                onPress={onRetry}
                variant="outline"
              />
            </View>
          ) : state.items.length === 0 ? (
            <View className="gap-2 py-12">
              <Text className="text-xl font-heading text-foreground">{copy.emptyTitle}</Text>
              <Text className="font-sans max-w-[560px] text-sm leading-5 text-muted-foreground">
                {copy.emptyDescription}
              </Text>
            </View>
          ) : (
            <View>
              <DataTable
                caption={copy.title}
                columns={columns}
                data={state.items}
                getRowId={(category) => category.id}
              />
              {state.hasNextPage ? (
                <Button
                  className="mt-6 self-start"
                  label={state.loadingMore ? copy.loadingMore : copy.loadMore}
                  loading={state.loadingMore}
                  onPress={onLoadMore}
                  variant="outline"
                />
              ) : null}
            </View>
          )}
        </>
      )}
    </Page>
  );
}
