import { ConfirmationPanel } from "./confirmation-panel";
import type { FinancialMutationState, ReceivableReviewCopy } from "./types";

type ReviewActions = {
  mutation: FinancialMutationState;
  onCancel: () => void;
  onConfirm: () => void;
  onRetrySameCommand: () => void;
};

type PostReceivableReviewProps = ReviewActions & {
  amount: string;
  copy: ReceivableReviewCopy;
  customerName: string;
  description: string;
  dueDate: string | null;
  postedDate: string;
};

export function PostReceivableReview({
  amount,
  copy,
  customerName,
  description,
  dueDate,
  postedDate,
  ...actions
}: PostReceivableReviewProps) {
  return (
    <ConfirmationPanel
      copy={copy}
      fields={[
        { label: copy.customer, value: customerName },
        { label: copy.amount, value: amount },
        { label: copy.description, value: description },
        { label: copy.postedDate, value: postedDate },
        { label: copy.dueDate, value: dueDate ?? copy.noDueDate },
      ]}
      {...actions}
    />
  );
}

type VoidReceivableReviewProps = ReviewActions & {
  amount: string;
  copy: ReceivableReviewCopy;
  description: string;
  reason: string;
};

export function VoidReceivableReview({
  amount,
  copy,
  description,
  reason,
  ...actions
}: VoidReceivableReviewProps) {
  return (
    <ConfirmationPanel
      copy={copy}
      fields={[
        { label: copy.description, value: description },
        { label: copy.amount, value: amount },
        { label: copy.reason, value: reason },
      ]}
      {...actions}
    />
  );
}

type PaymentReviewProps = ReviewActions & {
  amount: string;
  cashAccountName: string;
  copy: ReceivableReviewCopy;
  occurrence: string;
  reference: string | null;
};

export function PaymentReview({
  amount,
  cashAccountName,
  copy,
  occurrence,
  reference,
  ...actions
}: PaymentReviewProps) {
  return (
    <ConfirmationPanel
      copy={copy}
      fields={[
        { label: copy.amount, value: amount },
        { label: copy.cashAccount, value: cashAccountName },
        { label: copy.occurrence, value: occurrence },
        ...(reference ? [{ label: copy.reference, value: reference }] : []),
      ]}
      {...actions}
    />
  );
}

type PaymentReversalReviewProps = ReviewActions & {
  amount: string;
  cashAccountName: string;
  copy: ReceivableReviewCopy;
  occurrence: string;
  originalPayment: string;
  reference: string | null;
};

export function PaymentReversalReview({
  amount,
  cashAccountName,
  copy,
  occurrence,
  originalPayment,
  reference,
  ...actions
}: PaymentReversalReviewProps) {
  return (
    <ConfirmationPanel
      copy={copy}
      fields={[
        { label: copy.originalPayment, value: originalPayment },
        { label: copy.amount, value: amount },
        { label: copy.cashAccount, value: cashAccountName },
        { label: copy.occurrence, value: occurrence },
        ...(reference ? [{ label: copy.reference, value: reference }] : []),
      ]}
      {...actions}
    />
  );
}
