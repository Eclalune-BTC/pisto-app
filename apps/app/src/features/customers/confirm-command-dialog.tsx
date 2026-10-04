import { CircleAlert } from "lucide-react-native";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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

import type { FocusReturnRef } from "./focus-return";

type ConfirmCommandDialogProps = {
  cancelLabel: string;
  children?: ReactNode;
  /** Blocks the confirmation, for example while the reads behind it are stale. */
  confirmDisabled?: boolean;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  error?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  /** The control that opened the dialog; focus returns to it when the dialog closes. */
  returnFocusRef?: FocusReturnRef;
  title: string;
};

/**
 * The contract of `ui/confirm-dialog`: it cannot be dismissed while the command is pending and only
 * the caller closes it after a definitive result. It is composed here with a bounded web width
 * because the shared content's web max-width overrides its responsive one and fills the viewport.
 */
export function ConfirmCommandDialog({
  cancelLabel,
  children,
  confirmDisabled = false,
  confirmLabel,
  description,
  destructive = false,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending,
  returnFocusRef,
  title,
}: ConfirmCommandDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent
        className="web:max-w-md"
        onCloseAutoFocus={(event) => {
          // Opened from a menu that is already gone, the dialog would return focus to the body.
          if (!returnFocusRef?.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {error ? (
          <Alert icon={CircleAlert} variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            <Text>{cancelLabel}</Text>
          </AlertDialogCancel>
          <Button
            disabled={confirmDisabled}
            label={confirmLabel}
            loading={pending}
            onPress={onConfirm}
            variant={destructive ? "destructive" : "default"}
          />
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
