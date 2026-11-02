import { X } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { type FocusReturnRef, returnFocusOnClose } from "@/lib/focus-return";
import { isLockedPhase, type MutationPhase } from "@/lib/mutation-phase";
import { ReceivablePaymentForm } from "./receivable-payment-form";

type ReceivablePaymentSheetProps = {
  customerId?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (paymentId: string) => void;
  open: boolean;
  receivableId?: string;
  /** The control that opened the sheet; focus returns to it when the sheet closes. */
  returnFocusRef?: FocusReturnRef;
};

const SHEET_WIDTH = 440;

/** "Registrar abono" beside the list or record it was opened from, like the prototype's panel. */
export function ReceivablePaymentSheet({
  customerId,
  onOpenChange,
  onSaved,
  open,
  receivableId,
  returnFocusRef,
}: ReceivablePaymentSheetProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [phase, setPhase] = useState<MutationPhase>("idle");
  const locked = isLockedPhase(phase);
  const close = () => {
    if (!locked) onOpenChange(false);
  };
  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
      open={open}
    >
      {open ? (
        <SheetContent
          onCloseAutoFocus={returnFocusOnClose(returnFocusRef)}
          // Select menus render in their own portal; picking an option is not leaving the sheet.
          onInteractOutside={(event) => event.preventDefault()}
          side="right"
          style={{ width: Math.min(SHEET_WIDTH, width) }}
        >
          <View className="flex-row items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <SheetTitle className="font-heading text-base leading-6">
              {t("receivables.paymentForm.title")}
            </SheetTitle>
            <Button
              accessibilityLabel={t("common.close")}
              disabled={locked}
              onPress={close}
              size="icon-sm"
              variant="ghost"
            >
              <Icon as={X} className="text-muted-foreground" size={16} />
            </Button>
          </View>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 py-4"
            keyboardShouldPersistTaps="handled"
          >
            <ReceivablePaymentForm
              customerId={customerId}
              entrySource="manual"
              onCancel={close}
              onPhaseChange={setPhase}
              onSaved={(paymentId) => {
                setPhase("idle");
                onOpenChange(false);
                onSaved?.(paymentId);
              }}
              receivableId={receivableId}
            />
          </ScrollView>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}
