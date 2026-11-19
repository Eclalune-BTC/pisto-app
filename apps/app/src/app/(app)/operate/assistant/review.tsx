import type { DraftFormSlots } from "@/features/assistant/draft-slots";
import { AssistantReviewScreen } from "@/features/assistant/review-screen";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { SupplierPaymentForm } from "@/features/purchases/supplier-payment-form";
import { ReceivablePaymentForm } from "@/features/receivables/receivable-payment-form";
import { ItemizedSaleForm } from "@/features/sales/itemized/itemized-sale-form";
import { isLockedPhase } from "@/lib/mutation-phase";

const recordForms: DraftFormSlots = {
  sale: (props) => <ItemizedSaleForm {...props} />,
  expense: (props) => <ExpenseForm {...props} />,
  purchase: (props) => <PurchaseForm {...props} />,
  receivable_payment: ({ onLockedChange, ...props }) => (
    <ReceivablePaymentForm
      {...props}
      onPhaseChange={(phase) => onLockedChange(isLockedPhase(phase))}
    />
  ),
  supplier_payment: ({ onLockedChange, ...props }) => (
    <SupplierPaymentForm {...props} onBusyChange={onLockedChange} />
  ),
};

export default function AssistantReviewRoute() {
  return <AssistantReviewScreen slots={recordForms} />;
}
