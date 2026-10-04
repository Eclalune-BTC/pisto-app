import { CircleAlert, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions } from "react-native";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { isLockedPhase, type MutationPhase } from "./mutation-state";

const DIALOG_WIDTH = 448;

type ConfirmCommandDialogProps = {
  children?: ReactNode;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  /** Access or freshness was lost while the dialog was open. */
  disabled?: boolean;
  /** Message of a definitive failure; the dialog stays open so the command can be corrected. */
  errorMessage?: string;
  onCancel: () => void;
  /** Sends the command, or the same command again after an uncertain outcome. */
  onConfirm: () => void;
  open: boolean;
  phase: MutationPhase;
  title: string;
};

/**
 * Confirms a money command in place. Unlike the shared ConfirmDialog it also stays locked after
 * an uncertain outcome: dismissing it would discard the only key that can settle that result.
 */
export function ConfirmCommandDialog({
  children,
  confirmLabel,
  description,
  destructive = false,
  disabled = false,
  errorMessage,
  onCancel,
  onConfirm,
  open,
  phase,
  title,
}: ConfirmCommandDialogProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const locked = isLockedPhase(phase);
  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next && !locked) onCancel();
      }}
      open={open}
    >
      {/* The shared content ignores its width classes on the web; size it like the shared Sheet. */}
      <AlertDialogContent style={{ width: Math.min(DIALOG_WIDTH, width - 32) }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {phase === "uncertain" ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
            <AlertDescription>{t("cash.review.uncertainDescription")}</AlertDescription>
          </Alert>
        ) : phase === "failed" && errorMessage ? (
          <Alert icon={CircleAlert} variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel className={locked ? "opacity-50" : undefined} disabled={locked}>
            <Text>{t("common.cancel")}</Text>
          </AlertDialogCancel>
          <Button
            disabled={disabled}
            label={phase === "uncertain" ? t("common.retrySameConfirmation") : confirmLabel}
            loading={phase === "pending"}
            onPress={onConfirm}
            variant={destructive && phase !== "uncertain" ? "destructive" : "default"}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
