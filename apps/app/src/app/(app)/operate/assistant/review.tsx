import type { DraftFormSlots } from "@/features/assistant/draft-slots";
import { AssistantReviewScreen } from "@/features/assistant/review-screen";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { SupplierPaymentForm } from "@/features/purchases/supplier-payment-form";
import { ReceivablePaymentForm } from "@/features/receivables/receivable-payment-form";
import { ItemizedSaleForm } from "@/features/sales/itemized/itemized-sale-form";

const recordForms: DraftFormSlots = {
  sale: (props) => <ItemizedSaleForm {...props} />,
  expense: (props) => <ExpenseForm {...props} />,
  purchase: (props) => <PurchaseForm {...props} />,
  receivable_payment: (props) => <ReceivablePaymentForm {...props} />,
  supplier_payment: (props) => <SupplierPaymentForm {...props} />,
};

export default function AssistantReviewRoute() {
  return <AssistantReviewScreen slots={recordForms} />;
}
