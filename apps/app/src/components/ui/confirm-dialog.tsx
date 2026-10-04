import { CircleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "./alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import { Text } from "./text";

type ConfirmDialogProps = {
  cancelLabel: string;
  children?: ReactNode;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  /** Server or uncertain-outcome message; the dialog stays open so the same command can be retried. */
  error?: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  title: string;
};

/**
 * Explicit confirmation for a consequential command. It cannot be dismissed while the command is
 * pending, and confirming does not close it: the caller closes it after a definitive result.
 */
export function ConfirmDialog({
  cancelLabel,
  children,
  confirmLabel,
  description,
  destructive = false,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
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
