import {
  type AssistantToolCall,
  type BusinessPeriod,
  type BusinessPermission,
  type BusinessReply,
  type BusinessSource,
  type BusinessTopic,
  businessReadPermissions,
  businessTopicPermissions,
  periodBusinessTopics,
} from "@pisto/contracts";
import type { Href } from "expo-router";

export type QuestionTool = Extract<AssistantToolCall, { name: "answer_question" }>;
export type ConversationTurn = { name: "business_reply"; reply: BusinessReply };
export type CocoTool = AssistantToolCall | ConversationTurn;

export function permitsReply(permissions: readonly BusinessPermission[], reply: BusinessReply) {
  return (
    permissions.includes("assistant:use") &&
    (reply.kind !== "answer" ||
      reply.sources.every((source) =>
        businessReadPermissions(source).every((p) => permissions.includes(p)),
      ))
  );
}

/** The screen that owns each topic's figures. */
export const topicHrefs = {
  sales: "/operate/sales",
  top_products: "/operate/sales",
  expenses: "/operate/expenses",
  summary: "/operate/reports",
  cash: "/operate/cash",
  receivables: "/operate/receivables",
  payables: { pathname: "/operate/payables", params: { payable: "open" } },
  low_stock: "/operate/inventory",
} as const satisfies Record<BusinessTopic, Href>;

export const sourceHrefs = {
  ...topicHrefs,
  product_price: "/operate/catalog",
  product_stock: "/operate/inventory",
  customer: "/operate/customers",
  supplier: "/operate/suppliers",
  movements: "/operate/movements",
} as const satisfies Record<BusinessSource, Href>;

export function isPeriodTopic(topic: BusinessTopic): boolean {
  return (periodBusinessTopics as readonly BusinessTopic[]).includes(topic);
}

const question = (topic: BusinessTopic, period: BusinessPeriod | null = null): QuestionTool => ({
  name: "answer_question",
  topic,
  period,
});

/** Questions offered as one-tap shortcuts, most used first. */
export const suggestedQuestions = [
  { key: "salesToday", tool: question("sales", "today") },
  { key: "summaryWeek", tool: question("summary", "this_week") },
  { key: "cash", tool: question("cash") },
  { key: "receivables", tool: question("receivables") },
  { key: "payables", tool: question("payables") },
  { key: "lowStock", tool: question("low_stock") },
  { key: "topProducts", tool: question("top_products", "this_month") },
  { key: "expensesMonth", tool: question("expenses", "this_month") },
] as const;

export function permitsTopic(permissions: readonly BusinessPermission[], topic: BusinessTopic) {
  return permissions.includes(businessTopicPermissions[topic]);
}

/** Complete questions answered without the model. Other wordings go through interpretation. */
const topicPhrases: ReadonlyArray<readonly [BusinessTopic, readonly string[]]> = [
  [
    "sales",
    [
      "cuanto vendi",
      "cuanto vendimos",
      "cuanto llevo vendido",
      "cuanto he vendido",
      "cuantas ventas hice",
      "cuantas ventas tuvimos",
      "cuanto fue la venta promedio",
      "cual fue el promedio por venta",
      "como fueron mis ventas",
      "ventas",
    ],
  ],
  ["summary", ["como me fue", "como nos fue", "como va el negocio"]],
  ["expenses", ["cuanto gaste", "cuanto gastamos", "cuanto he gastado", "en que gaste", "gastos"]],
  [
    "top_products",
    [
      "que es lo que mas se vende",
      "que es lo que mas vendo",
      "que se vende mas",
      "que fue lo mas vendido",
      "cual es mi producto mas vendido",
      "productos mas vendidos",
    ],
  ],
  [
    "cash",
    [
      "cuanto tengo en caja",
      "cuanto hay en caja",
      "cuanto dinero tengo",
      "cuanto tengo disponible",
      "cuanto tengo en el banco",
    ],
  ],
  ["receivables", ["quien me debe", "quien me debe dinero", "quienes me deben", "cuanto me deben"]],
  [
    "payables",
    [
      "que facturas debo",
      "que facturas tengo pendientes de pagar",
      "a que proveedores les debo",
      "cuanto debo a proveedores",
      "cuanto les debo a mis proveedores",
    ],
  ],
  [
    "low_stock",
    [
      "que se esta acabando",
      "que se me esta acabando",
      "que productos se estan acabando",
      "que productos se me estan acabando",
      "que tengo que pedir",
      "que productos tienen pocas existencias",
    ],
  ],
];

const periodPhrases: Readonly<Record<string, BusinessPeriod>> = {
  hoy: "today",
  ayer: "yesterday",
  "esta semana": "this_week",
  "la semana pasada": "last_week",
  "este mes": "this_month",
  "el mes pasado": "last_month",
  "los ultimos 7 dias": "last_7_days",
  "los ultimos siete dias": "last_7_days",
  "los ultimos 30 dias": "last_30_days",
  "los ultimos treinta dias": "last_30_days",
};

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

/** "del mes pasado", "de hoy", "en esta semana" or the bare period; `null` for anything else. */
function periodOf(rest: string): BusinessPeriod | null {
  const phrase = rest.replace(/^del /u, "de el ").replace(/^(?:de|en) /u, "");
  return Object.hasOwn(periodPhrases, phrase) ? (periodPhrases[phrase] ?? null) : null;
}

export function matchBusinessQuestion(text: string): QuestionTool | undefined {
  const sentence = normalized(text);
  for (const [topic, phrases] of topicPhrases) {
    for (const phrase of phrases) {
      if (sentence === phrase) return question(topic);
      if (!isPeriodTopic(topic) || !sentence.startsWith(`${phrase} `)) continue;
      const period = periodOf(sentence.slice(phrase.length + 1));
      if (period) return question(topic, period);
    }
  }
  return undefined;
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

/** A question opens for any assistant user; its answer states when the role cannot read it. */
export function permitsTool(permissions: readonly BusinessPermission[], tool: AssistantToolCall) {
  if (!permissions.includes("assistant:use")) return false;
  if (tool.name === "answer_question") return true;
  return permissions.includes(tool.name === "start_sale" ? "sales:create" : "catalog:read");
}
