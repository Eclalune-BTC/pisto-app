import type { Extraction } from "./extraction.ts";

type PaymentInvoice = { kind: "number"; value: string } | { kind: "omitted" | "unclear" };

const unclear = { kind: "unclear" } as const;
const omitted = { kind: "omitted" } as const;
const numberPrefix =
  /^(?:[:#№]\s*|(?:(?:n[úu]mero|n[úu]m|nro|no)(?=[.\s:#]|$)\.?|n\.?[º°]\.?)\s*[:#]?\s*)/iu;
const bareCode = /\b\p{L}+[-_/]?\d/iu;
const choiceOrCorrection = /\b(?:o|u|no|sino|mejor|perdón|excepto|salvo|quise decir)\b/iu;
const currencyAmount =
  /(?:\p{Sc}\s*\d+(?:[.,]\d+)*|\b\d+(?:[.,]\d+)*\s*(?:d[oó]lares?|centavos?|USD)\b)/giu;

function looksLikeNumber(value: string) {
  return /\d/u.test(value) || /^\p{Lu}{2,}$/u.test(value);
}

export function paymentInvoice(
  sentence: string,
  extraction: Extraction,
  unread: boolean,
): PaymentInvoice {
  if (unread) return unclear;
  const mentions = [...sentence.matchAll(/\bfacturas?\b/giu)];
  const [mention] = mentions;
  const extracted = extraction.invoiceNumber?.toLowerCase();
  if (!mention) {
    // A product, supplier or transfer reference can itself look like an invoice number.
    return extracted ||
      bareCode.test(sentence) ||
      /\b(?:referencia|comprobante|transacción|operación)\b/iu.test(sentence) ||
      extraction.fragments.some((f) => f.field === "invoice")
      ? unclear
      : omitted;
  }
  if (mentions.length > 1 || mention[0].toLowerCase() === "facturas") return unclear;
  const before = sentence.slice(0, mention.index);
  if (bareCode.test(before) || choiceOrCorrection.test(before)) return unclear;
  const tail = sentence.slice(mention.index + mention[0].length).trimStart();
  if (
    !extracted &&
    /^(?:(?:pendiente|vencida|anterior)\b|[.!?,;]?\s*$)/iu.test(tail) &&
    !bareCode.test(tail) &&
    !/\d/.test(tail)
  ) {
    return omitted;
  }

  const reference = tail.replace(numberPrefix, "").replace(/^#\s*/, "");
  const token = reference.match(/^[^\s,;!?]+/u)?.[0];
  if (!token) return unclear;
  // Strip sentence punctuation only at the end. Interior punctuation and zeroes identify the record.
  const literal = token.replace(/\.+$/u, "");
  if (!/^[\p{L}\p{N}]/u.test(literal) || literal.length > 40 || !looksLikeNumber(literal))
    return unclear;
  const rest = reference.slice(token.length);
  const remaining = rest.replace(currencyAmount, "");
  // An amount may follow the invoice. A second identifier or a correction needs a human choice.
  if (choiceOrCorrection.test(rest) || bareCode.test(rest) || /\d/u.test(remaining)) return unclear;
  const alternatives = remaining.split(/[,;]|\b[ye]\b/iu).slice(1);
  if (
    alternatives.some((clause) => {
      const next = clause
        .trim()
        .replace(/^(?:(?:a|al|con|de|del|el|la|las|por)\s+)+/iu, "")
        .replace(numberPrefix, "")
        .split(/\s+/u)[0];
      return next && looksLikeNumber(next);
    })
  )
    return unclear;
  if (extracted && literal.toLowerCase() !== extracted) return unclear;
  return { kind: "number", value: literal.toLowerCase() };
}
