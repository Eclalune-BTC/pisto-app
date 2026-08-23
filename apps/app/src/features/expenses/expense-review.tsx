import type { PostExpenseRequest } from "../../../../../packages/contracts/src/cash.ts";

import { CashOperationReview, type CashOperationReviewCopy } from "../cash/cash-operation-review";
import type { CashConfirmationState } from "../cash/state";

type ExpenseReviewCopy = CashOperationReviewCopy & {
  amount: string;
  category: string;
  account: string;
  date: string;
  time: string;
  currency: string;
  description: string;
  payee: string;
  noPayee: string;
};

type ExpenseReviewProps = {
  command: PostExpenseRequest;
  accountName: string;
  categoryLabel: string;
  effect: string;
  state: CashConfirmationState;
  errorMessage?: string;
  copy: ExpenseReviewCopy;
  formatMoney: (minorUnits: string, currency: string) => string;
  onConfirm: () => void;
  onEdit: () => void;
  onCheckStatus: () => void;
};

export function ExpenseReview({
  command,
  accountName,
  categoryLabel,
  effect,
  state,
  errorMessage,
  copy,
  formatMoney,
  onConfirm,
  onEdit,
  onCheckStatus,
}: ExpenseReviewProps) {
  return (
    <CashOperationReview
      copy={copy}
      effect={effect}
      errorMessage={errorMessage}
      onCheckStatus={onCheckStatus}
      onConfirm={onConfirm}
      onEdit={onEdit}
      rows={[
        { label: copy.amount, value: formatMoney(command.amountMinorUnits, command.currency) },
        { label: copy.category, value: categoryLabel },
        { label: copy.account, value: accountName },
        { label: copy.date, value: command.occurredLocalDate },
        { label: copy.time, value: command.occurredLocalTime },
        { label: copy.currency, value: command.currency },
        { label: copy.description, value: command.description },
        { label: copy.payee, value: command.payee ?? copy.noPayee },
      ]}
      state={state}
    />
  );
}
