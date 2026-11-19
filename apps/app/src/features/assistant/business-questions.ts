import type { BusinessPermission } from "@pisto/contracts";
import type { Href } from "expo-router";

export const businessQuestions = {
  sales: {
    permission: "sales:summary:read",
    href: "/operate/assistant/sales-summary",
    phrases: [
      "como me fue el mes pasado",
      "cuanto vendi el mes pasado",
      "cuanto vendimos el mes pasado",
      "cuantas ventas hice el mes pasado",
      "cuantas ventas tuvimos el mes pasado",
      "cuanto fue la venta promedio del mes pasado",
      "cual fue el promedio por venta el mes pasado",
      "como fueron mis ventas el mes pasado",
      "ventas del mes pasado",
    ],
  },
  receivables: {
    permission: "receivables:read",
    href: "/operate/receivables",
    phrases: ["quien me debe", "quien me debe dinero", "quienes me deben", "cuanto me deben"],
  },
  payables: {
    permission: "purchases:read",
    href: { pathname: "/operate/payables", params: { payable: "open" } },
    phrases: [
      "que facturas debo",
      "que facturas tengo pendientes de pagar",
      "a que proveedores les debo",
      "cuanto debo a proveedores",
      "cuanto les debo a mis proveedores",
    ],
  },
} as const satisfies Record<
  string,
  { permission: BusinessPermission; href: Href; phrases: readonly string[] }
>;

export type BusinessQuestion = keyof typeof businessQuestions;
export const questionKinds = Object.keys(businessQuestions) as BusinessQuestion[];

export function matchBusinessQuestion(text: string): BusinessQuestion | undefined {
  const question = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^[¿¡]+/u, "")
    .replace(/[?!.]+$/u, "")
    .trim()
    .replace(/\s+/gu, " ");
  return questionKinds.find((kind) =>
    businessQuestions[kind].phrases.some((phrase) => phrase === question),
  );
}
