import type {
  ArchiveCategoryRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
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
import { ApiClientError } from "@/lib/api-error";
import { returnFocusOnClose } from "@/lib/focus-return";
import { useKeyedCommand } from "@/lib/keyed-command";
import { isLockedPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { catalogApi } from "./api";
import { buildCategoryCommand } from "./category-draft";
import { invalidateCatalogInventory } from "./queries";
import { type DialogFocus, dialogReturnFocus } from "./screen-heading";

type CategoryDialogProps = {
  businessId: string;
  /** Catalog management on fresh data; it can be lost while the dialog is open. */
  canConfirm: boolean;
  /** Focus returns to the opener on close, or to the screen title after an archive. */
  focus: DialogFocus;
  onClose: () => void;
};

type CategoryNameCommand = CreateCategoryRequest | UpdateCategoryRequest;

/**
 * Creates a category, or renames the given one. Mounted while open, so every dialog starts with a
 * fresh name and key; an unchanged name sent again keeps its key.
 */
export function CategoryNameDialog({
  businessId,
  canConfirm,
  category,
  focus,
  onClose,
}: CategoryDialogProps & { category: Category | null }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [name, setName] = useState(category?.name ?? "");
  const [error, setError] = useState<string>();
  const nameRef = useRef<TextInput>(null);
  const command = useKeyedCommand({
    mutationFn: (variables: CategoryNameCommand) =>
      category
        ? catalogApi.categories.update(category.id, variables)
        : catalogApi.categories.create(variables),
    onConfirmed: async ({ category: saved }) => {
      await invalidateCatalogInventory(queryClient, businessId);
      notify.success(category ? t("catalog.categories.renamed") : t("catalog.categories.created"), {
        description: saved.name,
      });
      onClose();
    },
  });
  const { phase } = command;
  const locked = isLockedPhase(phase);
  // A taken name is the field's problem; any other failure belongs to the whole command.
  const conflict =
    phase === "failed" &&
    command.error instanceof ApiClientError &&
    command.error.code === "CONFLICT";
  const fieldError =
    error ??
    (conflict
      ? category
        ? t("catalog.categories.renameConflict")
        : t("catalog.categories.duplicateName")
      : undefined);

  const confirm = () => {
    if (phase === "pending") return;
    // Sending the same command again cannot apply it twice; only a new decision needs access.
    if (phase === "uncertain") {
      if (command.variables) command.send(command.variables);
      return;
    }
    if (!canConfirm) return;
    const result = buildCategoryCommand({
      idempotencyKey: Crypto.randomUUID(),
      mode: category ? "edit" : "create",
      name,
    });
    if ("error" in result) {
      setError(
        result.error === "missing-name"
          ? t("catalog.categories.nameMissing")
          : t("catalog.categories.nameTooLong"),
      );
      // A rejected name takes focus back, so the person can correct it right away.
      nameRef.current?.focus();
      return;
    }
    if (category && result.command.name === category.name) {
      setError(t("catalog.categories.unchangedName"));
      nameRef.current?.focus();
      return;
    }
    setError(undefined);
    command.send(withStableIdempotencyKey(command.variables, result.command));
  };
  const close = () => {
    if (!locked) onClose();
  };

  useEffect(() => {
    if (conflict) nameRef.current?.focus();
  }, [conflict]);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close();
      }}
      open
    >
      <DialogContent
        // The same width as a confirmation; the container itself never shows a focus ring.
        className="sm:max-w-md web:outline-none"
        hideClose={locked}
        onCloseAutoFocus={returnFocusOnClose(focus.opener)}
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
          error={fieldError}
          label={t("catalog.categories.name")}
          maxLength={80}
          onChangeText={(value) => {
            setName(value);
            setError(undefined);
            // A rejected name being corrected is a new command; its stale failure goes away.
            if (phase === "failed") command.reset();
          }}
          onSubmitEditing={confirm}
          placeholder={t("catalog.categories.namePlaceholder")}
          ref={nameRef}
          returnKeyType="done"
          value={name}
        />
        {phase === "uncertain" ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
            <AlertDescription>{t("catalog.categories.uncertainDescription")}</AlertDescription>
          </Alert>
        ) : phase === "failed" && !conflict ? (
          <Alert icon={CircleAlert} variant="destructive">
            <AlertDescription>
              {productErrorMessage(
                command.error,
                t("productErrors.contexts.category.fallback"),
                t,
                "category",
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button disabled={locked} label={t("common.cancel")} onPress={close} variant="outline" />
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
  focus,
  onClose,
}: CategoryDialogProps & { category: Category }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [archived, setArchived] = useState(false);
  const archive = useKeyedCommand({
    mutationFn: (command: ArchiveCategoryRequest) =>
      catalogApi.categories.archive(category.id, command),
    onConfirmed: async () => {
      setArchived(true);
      await invalidateCatalogInventory(queryClient, businessId);
      notify.success(t("catalog.categories.archived"), { description: category.name });
      onClose();
    },
  });
  const { phase } = archive;
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
          archive.send(archive.variables);
          return;
        }
        if (!canConfirm) return;
        // Archiving has no reviewable fields; every attempt in one dialog is the same command.
        archive.send(archive.variables ?? { idempotencyKey: Crypto.randomUUID() });
      }}
      open
      phase={phase}
      returnFocus={dialogReturnFocus(focus, archived)}
      title={t("catalog.categories.archiveTitle", { name: category.name })}
      uncertainDescription={t("catalog.categories.uncertainDescription")}
    />
  );
}
