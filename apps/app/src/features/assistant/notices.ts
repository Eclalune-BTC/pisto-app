import type { AssistantDraft, AssistantField, AssistantNotice } from "@pisto/contracts";
import type { ParseKeys, TFunction } from "i18next";

const missingKeys: Partial<Record<AssistantField, ParseKeys>> = {
  amount: "assistant.notices.missing.amount",
  received: "assistant.notices.missing.received",
  paymentMethod: "assistant.notices.missing.paymentMethod",
  account: "assistant.notices.missing.account",
  customer: "assistant.notices.missing.customer",
  supplier: "assistant.notices.missing.supplier",
  category: "assistant.notices.missing.category",
  description: "assistant.notices.missing.description",
  date: "assistant.notices.missing.date",
  dueDate: "assistant.notices.missing.dueDate",
  credit: "assistant.notices.missing.credit",
};

type Party = { heard: string | null; match: { name: string } | null };

function partyOf(draft: AssistantDraft, field: "customer" | "supplier"): Party | null {
  if (field === "customer" && "customer" in draft) return draft.customer;
  if (field === "supplier" && "supplier" in draft) return draft.supplier;
  return null;
}

function lineOf(draft: AssistantDraft, index: number | null) {
  if (index === null || !("lines" in draft)) return null;
  return draft.lines[index] ?? null;
}

/** The sentence the review shows for a notice, worded from the draft it refers to. */
export function noticeMessage(
  t: TFunction,
  notice: AssistantNotice,
  draft: AssistantDraft,
): string {
  const line = lineOf(draft, notice.lineIndex);
  const item = line?.heard ?? "";
  switch (notice.code) {
    case "not_permitted":
      return t("assistant.notices.notPermitted");
    case "total_mismatch":
      return line
        ? t("assistant.notices.priceMismatch", { item })
        : t("assistant.notices.totalMismatch");
    case "insufficient_stock":
      return t("assistant.notices.insufficientStock", { name: line?.product?.name ?? item });
    case "exceeds_total":
      return notice.field === "received"
        ? t("assistant.notices.exceeds.received")
        : t("assistant.notices.exceeds.amount");
    case "similar_match": {
      if (notice.field === "product") {
        return line?.product
          ? t("assistant.notices.similar.product", { item, name: line.product.name })
          : t("assistant.notices.similar.productChoose", { item });
      }
      const party =
        notice.field === "customer" || notice.field === "supplier"
          ? partyOf(draft, notice.field)
          : null;
      const heard = party?.heard ?? "";
      if (notice.field === "supplier") {
        return party?.match
          ? t("assistant.notices.similar.supplier", { name: party.match.name })
          : t("assistant.notices.similar.supplierChoose", { heard });
      }
      return party?.match
        ? t("assistant.notices.similar.customer", { name: party.match.name })
        : t("assistant.notices.similar.customerChoose", { heard });
    }
    case "not_found":
      switch (notice.field) {
        case "customer":
          return t("assistant.notices.notFound.customer", {
            heard: partyOf(draft, "customer")?.heard ?? "",
          });
        case "supplier":
          return t("assistant.notices.notFound.supplier", {
            heard: partyOf(draft, "supplier")?.heard ?? "",
          });
        case "product":
          return t("assistant.notices.notFound.product", { item });
        case "credit":
          return draft.kind === "supplier_payment"
            ? t("assistant.notices.notFound.purchase")
            : t("assistant.notices.notFound.receivable");
        default:
          return t("assistant.notices.notFound.other");
      }
    case "missing":
      if (line && notice.field === "quantity") {
        return t("assistant.notices.missing.quantity", { item });
      }
      if (line && notice.field === "amount") {
        return t("assistant.notices.missing.lineAmount", { item });
      }
      return t(missingKeys[notice.field] ?? "assistant.notices.missing.other");
  }
}
