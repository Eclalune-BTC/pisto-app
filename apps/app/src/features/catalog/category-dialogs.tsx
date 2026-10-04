import type {
  ArchiveCategoryRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { returnFocusOnClose } from "@/lib/focus-return";
import { isLockedPhase, mutationPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { catalogApi } from "./api";
import { buildCategoryCommand } from "./category-draft";
import { invalidateCatalogInventory } from "./queries";

const DIALOG_WIDTH = 440;

type CategoryDialogProps = {
  businessId: string;
  /** Catalog management on fresh data; it can be lost while the dialog is open. */
  canConfirm: boolean;
  onClose: () => void;
  /** The control that opened the dialog; focus returns to it on close. */
  returnFocus: HTMLElement | null;
};

/**
 * Creates a category, or renames the given one. Mounted while open, so every dialog starts with a
 * fresh name and key; an unchanged name sent again keeps its key.
 */
export function CategoryNameDialog({
  businessId,
  canConfirm,
  category,
  onClose,
  returnFocus,
}: CategoryDialogProps & { category: Category | null }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string>();
  const mutation = useMutation({
    mutationFn: (command: CreateCategoryRequest | UpdateCategoryRequest) =>
      category
        ? catalogApi.categories.update(category.id, command)
        : catalogApi.categories.create(command),
    onSuccess: async ({ category: saved }) => {
      await invalidateCatalogInventory(queryClient, businessId);
      notify.success(category ? t("catalog.categories.renamed") : t("catalog.categories.created"), {
        description: saved.name,
      });
      onClose();
    },
  });
  const phase = mutationPhase(mutation);
  const locked = isLockedPhase(phase);

  const confirm = () => {
    if (phase === "pending") return;
    // Sending the same command again cannot apply it twice; only a new decision needs access.
    if (phase === "uncertain") {
      if (mutation.variables) mutation.mutate(mutation.variables);
      return;
    }
    if (!canConfirm) return;
    const result = buildCategoryCommand({
      idempotencyKey: Crypto.randomUUID(),
      mode: category ? "edit" : "create",
      name,
    });
    if ("error" in result) {
      setError(t("catalog.categories.nameValidation"));
      return;
    }
    if (category && result.command.name === category.name) {
      setError(t("catalog.categories.unchangedName"));
      return;
    }
    setError(undefined);
    mutation.mutate(withStableIdempotencyKey(mutation.variables, result.command));
  };
  const close = () => {
    if (!locked) onClose();
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open
    >
      {/* The shared content ignores its width classes on the web; size it like the shared Sheet. */}
      <DialogContent
        hideClose={locked}
        onCloseAutoFocus={returnFocusOnClose(returnFocus)}
        style={{ width: Math.min(DIALOG_WIDTH, width - 32) }}
      >
        <DialogHeader>
          <DialogTitle>
            {category
              ? t("catalog.categories.renameTitle", { name: category.name })
              : t("catalog.categories.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {category
              ? t("catalog.categories.renameDescription")
              : t("catalog.categories.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <Field
          autoFocus
          editable={!locked}
          error={error}
          label={t("catalog.categories.name")}
          maxLength={80}
          onChangeText={(value) => {
            setName(value);
            setError(undefined);
            // A rejected name being corrected is a new command; its stale failure goes away.
            if (phase === "failed") mutation.reset();
          }}
          onSubmitEditing={confirm}
          placeholder={t("catalog.categories.namePlaceholder")}
          returnKeyType="done"
          value={name}
        />
        {phase === "uncertain" ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
            <AlertDescription>{t("catalog.categories.uncertainDescription")}</AlertDescription>
          </Alert>
        ) : phase === "failed" ? (
          <Alert icon={CircleAlert} variant="destructive">
            <AlertDescription>
              {productErrorMessage(
                mutation.error,
                t("productErrors.contexts.category.fallback"),
                t,
                "category",
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            className={locked ? "opacity-50" : undefined}
            disabled={locked}
            label={t("common.cancel")}
            onPress={close}
            variant="outline"
          />
          <Button
            disabled={!canConfirm && phase !== "uncertain"}
            label={
              phase === "uncertain"
                ? t("common.retrySameConfirmation")
                : category
                  ? t("catalog.categories.confirmRename")
                  : t("catalog.categories.confirmCreate")
            }
            loading={phase === "pending"}
            onPress={confirm}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Archives a category after an explicit confirmation; one key serves every attempt. */
export function CategoryArchiveDialog({
  businessId,
  canConfirm,
  category,
  onClose,
  returnFocus,
}: CategoryDialogProps & { category: Category }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const archive = useMutation({
    mutationFn: (command: ArchiveCategoryRequest) =>
      catalogApi.categories.archive(category.id, command),
    onSuccess: async () => {
      await invalidateCatalogInventory(queryClient, businessId);
      notify.success(t("catalog.categories.archived"), { description: category.name });
      onClose();
    },
  });
  const phase = mutationPhase(archive);
  return (
    <ConfirmDialog
      confirmLabel={t("catalog.categories.archiveConfirm")}
      description={t("catalog.categories.archiveDescription")}
      destructive
      disabled={!canConfirm}
      errorMessage={
        archive.error
          ? productErrorMessage(
              archive.error,
              t("productErrors.contexts.category.fallback"),
              t,
              "category",
            )
          : undefined
      }
      onCancel={onClose}
      onConfirm={() => {
        if (phase === "pending") return;
        if (phase === "uncertain" && archive.variables) {
          archive.mutate(archive.variables);
          return;
        }
        if (!canConfirm) return;
        // Archiving has no reviewable fields; every attempt in one dialog is the same command.
        archive.mutate(archive.variables ?? { idempotencyKey: Crypto.randomUUID() });
      }}
      open
      phase={phase}
      returnFocus={returnFocus}
      title={t("catalog.categories.archiveTitle", { name: category.name })}
      uncertainDescription={t("catalog.categories.uncertainDescription")}
    />
  );
}
