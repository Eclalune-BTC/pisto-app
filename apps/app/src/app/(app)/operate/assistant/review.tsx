import { previewDraftFormSlots } from "@/features/assistant/draft-preview";
import type { DraftFormSlots } from "@/features/assistant/draft-slots";
import { AssistantReviewScreen } from "@/features/assistant/review-screen";
import { PurchaseForm } from "@/features/purchases/purchase-form";
import { SupplierPaymentForm } from "@/features/purchases/supplier-payment-form";
import { ItemizedSaleForm } from "@/features/sales/itemized/itemized-sale-form";

const recordForms: DraftFormSlots = {
  ...previewDraftFormSlots,
  sale: (props) => <ItemizedSaleForm {...props} />,
  purchase: (props) => <PurchaseForm {...props} />,
  supplier_payment: (props) => <SupplierPaymentForm {...props} />,
};

export default function AssistantReviewRoute() {
  return <AssistantReviewScreen slots={recordForms} />;
}
