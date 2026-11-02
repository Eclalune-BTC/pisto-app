import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type FocusReturnRef, returnFocusOnClose } from "@/lib/focus-return";

import { SupplierPaymentForm } from "./supplier-payment-form";

type SupplierPaymentDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  purchaseId?: string;
  returnFocusRef?: FocusReturnRef;
  supplierId?: string;
};

/** Registers a supplier payment in place; a sent payment keeps the dialog until it settles. */
export function SupplierPaymentDialog({
  onOpenChange,
  open,
  purchaseId,
  returnFocusRef,
  supplierId,
}: SupplierPaymentDialogProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent
        className="max-h-[92%] gap-3 p-4 sm:max-w-md web:w-[28rem]"
        hideClose={busy}
        onCloseAutoFocus={returnFocusOnClose(returnFocusRef)}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{t("purchases.payment.title")}</DialogTitle>
          {purchaseId ? null : (
            <DialogDescription>{t("purchases.payment.descriptionNoPurchase")}</DialogDescription>
          )}
        </DialogHeader>
        <ScrollView keyboardShouldPersistTaps="handled">
          {open ? (
            <SupplierPaymentForm
              entrySource="manual"
              onBusyChange={setBusy}
              onCancel={() => onOpenChange(false)}
              onSaved={() => onOpenChange(false)}
              purchaseId={purchaseId}
              supplierId={supplierId}
            />
          ) : null}
        </ScrollView>
      </DialogContent>
    </Dialog>
  );
}
