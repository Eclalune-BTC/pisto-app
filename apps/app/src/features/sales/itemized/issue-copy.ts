import type { TFunction } from "i18next";
import type { ItemizedDraftIssues, LineIssue, SaleIssue } from "./itemized-draft";

/** The sentence under a line's control; the stock shortfall is shown by the line's stock hint. */
export function lineIssueMessage(t: TFunction, issue: LineIssue, precision: number): string {
  switch (issue) {
    case "quantity-required":
      return t("sales.itemized.validation.quantityRequired");
    case "quantity-invalid":
      return t("sales.itemized.validation.quantityInvalid");
    case "quantity-decimals":
      return precision === 0
        ? t("sales.itemized.validation.quantityWhole")
        : t("sales.itemized.validation.quantityDecimals", { count: precision });
    case "price-required":
      return t("sales.itemized.validation.priceRequired");
    case "price-invalid":
      return t("sales.itemized.validation.priceInvalid");
    case "stock":
      return t("sales.itemized.validation.stock");
  }
}

const saleIssueKeys = {
  "lines-required": "sales.itemized.validation.linesRequired",
  "total-zero": "sales.itemized.validation.totalZero",
  date: "sales.validation.date",
  time: "sales.validation.time",
  "note-too-long": "sales.validation.description",
  "received-invalid": "sales.itemized.validation.receivedInvalid",
  "received-exceeds": "sales.itemized.validation.receivedExceeds",
  "account-required": "sales.itemized.validation.accountRequired",
  "customer-required": "sales.itemized.validation.customerRequired",
  "due-date-required": "sales.itemized.validation.dueDateRequired",
  "due-date-invalid": "sales.itemized.validation.dueDateInvalid",
  "due-date-before-sale": "sales.itemized.validation.dueDateBeforeSale",
} as const satisfies Record<SaleIssue, string>;

export function saleIssueMessages(
  t: TFunction,
  issues: ItemizedDraftIssues["sale"],
): Partial<Record<keyof ItemizedDraftIssues["sale"], string>> {
  const messages: Partial<Record<keyof ItemizedDraftIssues["sale"], string>> = {};
  for (const [field, issue] of Object.entries(issues) as [
    keyof ItemizedDraftIssues["sale"],
    SaleIssue | undefined,
  ][]) {
    if (issue) messages[field] = t(saleIssueKeys[issue]);
  }
  return messages;
}
