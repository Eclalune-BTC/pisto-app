import type { AssistantToolCall, BusinessPermission } from "@pisto/contracts";
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

function normalized(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/^[¿¡]+/u, "")
    .replace(/[?!.]+$/u, "")
    .trim()
    .replace(/\s+/gu, " ");
}

export function matchBusinessQuestion(text: string): BusinessQuestion | undefined {
  const question = normalized(text);
  return questionKinds.find((kind) =>
    businessQuestions[kind].phrases.some((phrase) => phrase === question),
  );
}

/** Match complete launcher commands only. Sale details still go through record extraction. */
export function matchSaleTool(text: string): AssistantToolCall | undefined {
  const command = normalized(text);
  if (
    /^(?:(?:quiero|necesito|quisiera|ayudame a) )?(?:ingresar|registrar|anotar|apuntar|hacer|abrir) (?:una |la |mis |las )?ventas?(?: por favor)?$/u.test(
      command,
    )
  ) {
    return { name: "start_sale" };
  }
  if (["nueva venta", "vender", "iniciar venta"].includes(command)) return { name: "start_sale" };
  if (["buscar producto", "buscar un producto", "consultar catalogo"].includes(command)) {
    return { name: "find_product", query: null };
  }
  const term = text
    .trim()
    .match(/^(?:buscar|busca|busque)\s+(?:(?:el|un)\s+)?producto\s+(.+?)\s*[?!.]?$/iu)?.[1]
    ?.trim();
  if (term && term.length <= 120) return { name: "find_product", query: term };
  return undefined;
}

export function permitsTool(permissions: readonly BusinessPermission[], tool: AssistantToolCall) {
  return (
    permissions.includes("assistant:use") &&
    permissions.includes(tool.name === "start_sale" ? "sales:create" : "catalog:read")
  );
}
