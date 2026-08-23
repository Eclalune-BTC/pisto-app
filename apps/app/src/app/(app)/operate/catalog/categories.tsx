import type {
  ArchiveCategoryRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { catalogApi } from "@/features/catalog/api";
import { buildCategoryCommand } from "@/features/catalog/category-draft";
import { type CategoryCollectionState, CategoryManager } from "@/features/catalog/category-manager";
import { buildCatalogCopy } from "@/features/catalog/copy";
import { useCategoriesQuery } from "@/features/catalog/queries";
import {
  type CatalogStatusFilter,
  catalogInventoryQueryKeys,
  flattenPages,
} from "@/features/catalog/query-keys";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { isDeniedError, mutationUiState } from "@/features/catalog/state";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

type CategoryWriteCommand = CreateCategoryRequest | UpdateCategoryRequest;

type EditorState = {
  categoryId?: string;
  command: CategoryWriteCommand | null;
  error?: string;
  mode: "create" | "edit";
  name: string;
};

type ArchiveState = {
  category: Category;
  command: ArchiveCategoryRequest;
};

export default function CategoriesRoute() {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCatalogCopy(t), [t]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CatalogStatusFilter>("active");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [archive, setArchive] = useState<ArchiveState | null>(null);
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canRead = business?.access.permissions.includes("catalog:read") ?? false;
  const roleCanManage = business?.access.permissions.includes("catalog:manage") ?? false;
  const canManage = roleCanManage && businesses.fetchStatus !== "paused" && !businesses.isError;
  const categories = useCategoriesQuery({
    businessId: business?.id,
    enabled: Boolean(business && canRead),
    search,
    status,
  });

  const categoryMutation = useMutation({
    mutationFn: async (input: {
      categoryId?: string;
      command: CategoryWriteCommand;
      mode: "create" | "edit";
    }) =>
      input.mode === "create"
        ? catalogApi.categories.create(input.command as CreateCategoryRequest)
        : catalogApi.categories.update(
            input.categoryId as string,
            input.command as UpdateCategoryRequest,
          ),
    networkMode: "always",
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: catalogInventoryQueryKeys.categoriesRoot(business?.id),
      });
      setEditor(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (input: ArchiveState) =>
      catalogApi.categories.archive(input.category.id, input.command),
    networkMode: "always",
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: catalogInventoryQueryKeys.categoriesRoot(business?.id),
      });
      setArchive(null);
    },
  });

  if (businesses.fetchStatus === "paused" && !businesses.data) {
    return <CapabilityRouteState kind="offline" />;
  }
  if (businesses.isPending) return <CapabilityRouteState kind="loading" />;
  if (businesses.isError && !businesses.data) {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (!business) return <Redirect href="/business" />;

  let collectionState: CategoryCollectionState;
  if (!canRead || isDeniedError(categories.error)) {
    collectionState = { status: "denied" };
  } else if (categories.fetchStatus === "paused" && !categories.data) {
    collectionState = { status: "offline" };
  } else if (categories.isPending) {
    collectionState = { status: "loading" };
  } else if (categories.isError && !categories.data) {
    collectionState = { status: "error" };
  } else {
    collectionState = {
      status: "ready",
      hasNextPage: Boolean(categories.hasNextPage),
      items: flattenPages(categories.data?.pages),
      loadingMore: categories.isFetchingNextPage,
      stale:
        businesses.isError ||
        categories.isError ||
        (categories.fetchStatus === "paused" && Boolean(categories.data)),
    };
  }

  const editorMutationState = mutationUiState({
    error: categoryMutation.error,
    isPending: categoryMutation.isPending,
  });
  const archiveMutationState = mutationUiState({
    error: archiveMutation.error,
    isPending: archiveMutation.isPending,
  });

  const reviewEditor = () => {
    if (!editor || !canManage) return;
    const result = buildCategoryCommand({
      idempotencyKey: Crypto.randomUUID(),
      mode: editor.mode,
      name: editor.name,
    });
    if ("error" in result) {
      setEditor({ ...editor, error: copy.categories.nameValidation });
      return;
    }
    categoryMutation.reset();
    setEditor({ ...editor, command: result.command, error: undefined });
  };

  const confirmEditor = () => {
    if (!editor?.command || !canManage) return;
    categoryMutation.mutate({
      categoryId: editor.categoryId,
      command: editor.command,
      mode: editor.mode,
    });
  };

  const confirmArchive = () => {
    if (archive && canManage) archiveMutation.mutate(archive);
  };

  return (
    <CategoryManager
      archiveView={
        archive
          ? {
              category: archive.category,
              mutationMessage: archiveMutation.error
                ? productErrorMessage(
                    archiveMutation.error,
                    copy.errorFallbacks.category,
                    t,
                    "category",
                  )
                : undefined,
              mutationState: archiveMutationState,
            }
          : null
      }
      canManage={canManage}
      copy={copy.categories}
      editor={
        editor
          ? {
              error: editor.error,
              mode: editor.mode,
              mutationMessage: categoryMutation.error
                ? productErrorMessage(
                    categoryMutation.error,
                    copy.errorFallbacks.category,
                    t,
                    "category",
                  )
                : undefined,
              mutationState: editorMutationState,
              name: editor.name,
              reviewName: editor.command?.name ?? null,
            }
          : null
      }
      onArchive={(category) => {
        archiveMutation.reset();
        setArchive({ category, command: { idempotencyKey: Crypto.randomUUID() } });
      }}
      onBack={() => router.replace("/operate/catalog")}
      onCancelArchive={() => {
        archiveMutation.reset();
        setArchive(null);
      }}
      onCancelEditor={() => {
        categoryMutation.reset();
        setEditor(null);
      }}
      onConfirmArchive={confirmArchive}
      onConfirmEditor={confirmEditor}
      onCreate={() => {
        categoryMutation.reset();
        setEditor({ command: null, mode: "create", name: "" });
      }}
      onEdit={(category) => {
        categoryMutation.reset();
        setEditor({
          categoryId: category.id,
          command: null,
          mode: "edit",
          name: category.name,
        });
      }}
      onEditReview={() => {
        if (!editor || editorMutationState === "uncertain") return;
        categoryMutation.reset();
        setEditor({ ...editor, command: null });
      }}
      onLoadMore={() => void categories.fetchNextPage()}
      onNameChange={(name) => {
        if (editor) setEditor({ ...editor, command: null, error: undefined, name });
      }}
      onResolveArchive={confirmArchive}
      onResolveEditor={confirmEditor}
      onRetry={() => void categories.refetch()}
      onReviewEditor={reviewEditor}
      onSearchChange={setSearch}
      onStatusChange={setStatus}
      search={search}
      showReadOnlyNotice={!roleCanManage}
      state={collectionState}
      status={status}
    />
  );
}
