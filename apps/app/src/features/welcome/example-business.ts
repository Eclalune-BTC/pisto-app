import type { CashFlowReport, MoneyTrend, MovementKind } from "@pisto/contracts";
import type { EntrySource } from "@/features/movements/presentation";

/**
 * The illustrative business the public page draws with the product's own components. Every figure
 * here is invented, adds up, and is labelled on the page as an example; nothing is read from an
 * account. Dates are counted from today in El Salvador so the example never looks stale.
 */
export const EXAMPLE_TIME_ZONE = "America/El_Salvador";
export const EXAMPLE_CURRENCY = "USD";
export const EXAMPLE_DIGITS = 2;

/** The calendar date `offset` days away from a business-local `today` (YYYY-MM-DD). */
export function shiftLocalDate(today: string, offset: number): string {
  const [year, month, day] = today.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`"${today}" is not a calendar date.`);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

/** The calendar month `offset` months away from a business-local `today`, as YYYY-MM. */
export function shiftLocalMonth(today: string, offset: number): string {
  const [year, month] = today.split("-").map(Number);
  if (!year || !month) throw new Error(`"${today}" is not a calendar date.`);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
}

/** Money held at the close of each of the last 31 days, ending with today's $4,857.30. */
const CLOSINGS = [
  "433000",
  "438250",
  "441900",
  "436420",
  "444800",
  "451230",
  "447610",
  "455900",
  "462340",
  "458120",
  "449870",
  "456300",
  "463950",
  "470210",
  "466480",
  "459030",
  "452760",
  "461400",
  "468920",
  "475310",
  "471050",
  "463880",
  "470640",
  "478220",
  "484900",
  "480370",
  "474150",
  "479860",
  "486420",
  "481930",
  "485730",
] as const;

/** Caja and Banco add up to the last closing. */
export const EXAMPLE_ACCOUNTS = { cash: "130730", bank: "355000" } as const;

export function exampleMoneyTrend(today: string): MoneyTrend {
  const last = CLOSINGS.length - 1;
  const points = CLOSINGS.map((closingMinorUnits, index) => ({
    localDate: shiftLocalDate(today, index - last),
    closingMinorUnits,
  }));
  const first = CLOSINGS[0];
  const closing = CLOSINGS[last];
  if (!closing) throw new Error("The example trend needs a closing balance.");
  return {
    range: "30d",
    startLocalDate: shiftLocalDate(today, -last),
    endLocalDate: today,
    timeZone: EXAMPLE_TIME_ZONE,
    currency: EXAMPLE_CURRENCY,
    currencyMinorUnitDigits: EXAMPLE_DIGITS,
    activeAccountCount: "2",
    openingMinorUnits: first,
    closingMinorUnits: closing,
    changeMinorUnits: String(BigInt(closing) - BigInt(first)),
    points,
    kinds: [
      { kind: "cash", accountCount: "1", balanceMinorUnits: EXAMPLE_ACCOUNTS.cash },
      { kind: "bank", accountCount: "1", balanceMinorUnits: EXAMPLE_ACCOUNTS.bank },
    ],
    queriedAt: new Date().toISOString(),
  };
}

export type ExampleMovement = {
  /** Which wording `useMovementCopy` gives the row. */
  key:
    | "dictatedSale"
    | "rosaPayment"
    | "electricity"
    | "bakeryPurchase"
    | "counterSale"
    | "creditSale"
    | "dairyPayment"
    | "rent"
    | "pedroPayment"
    | "morningSale";
  kind: MovementKind;
  source: EntrySource;
  time: string;
  amountMinorUnits: string;
};

/** Today's movements, newest first; the dictated sale is the one "Cómo funciona" saves. */
export const EXAMPLE_MOVEMENTS: readonly ExampleMovement[] = [
  { key: "dictatedSale", kind: "sale", source: "voice", time: "10:12", amountMinorUnits: "500" },
  {
    key: "rosaPayment",
    kind: "receivable_payment",
    source: "voice",
    time: "10:05",
    amountMinorUnits: "2000",
  },
  { key: "electricity", kind: "expense", source: "text", time: "09:45", amountMinorUnits: "-6420" },
  {
    key: "bakeryPurchase",
    kind: "purchase",
    source: "manual",
    time: "09:20",
    amountMinorUnits: "-4200",
  },
  { key: "counterSale", kind: "sale", source: "manual", time: "08:45", amountMinorUnits: "2340" },
];

/** Yesterday's movements, newest first: the Movimientos preview shows a day the home does not. */
export const EXAMPLE_YESTERDAY: readonly ExampleMovement[] = [
  { key: "creditSale", kind: "sale", source: "voice", time: "17:40", amountMinorUnits: "1000" },
  {
    key: "dairyPayment",
    kind: "supplier_payment",
    source: "manual",
    time: "16:15",
    amountMinorUnits: "-12000",
  },
  { key: "rent", kind: "expense", source: "text", time: "11:30", amountMinorUnits: "-25000" },
  {
    key: "pedroPayment",
    kind: "receivable_payment",
    source: "voice",
    time: "10:50",
    amountMinorUnits: "1500",
  },
  { key: "morningSale", kind: "sale", source: "manual", time: "07:55", amountMinorUnits: "6125" },
];

/** Money in and out across a list of movements. */
export function movementTotals(movements: readonly ExampleMovement[]) {
  let inflow = 0n;
  let outflow = 0n;
  for (const movement of movements) {
    const amount = BigInt(movement.amountMinorUnits);
    if (amount > 0n) inflow += amount;
    else outflow -= amount;
  }
  return { inflow: String(inflow), outflow: String(outflow) };
}

export type AgingBucket = "current" | "days1To30" | "days31To60" | "over60";

/** What customers owe by days late; the three late buckets are the overdue total. */
export const EXAMPLE_AGING: Record<AgingBucket, { minorUnits: string; accounts: number }> = {
  current: { minorUnits: "66925", accounts: 5 },
  days1To30: { minorUnits: "21250", accounts: 1 },
  days31To60: { minorUnits: "31050", accounts: 2 },
  over60: { minorUnits: "8750", accounts: 1 },
};

export const EXAMPLE_RECEIVABLES = {
  outstanding: "127975",
  overdue: "61050",
  customers: 8,
} as const;

/**
 * Caja and "Le deben" before the dictated sale: it brought $5.00 in cash and left $4.75 on credit,
 * which is how they reach `EXAMPLE_ACCOUNTS.cash` and `EXAMPLE_RECEIVABLES.outstanding`.
 */
export const BEFORE_DICTATED_SALE = { cash: "130230", receivables: "127500" } as const;

export type ExampleBalance = {
  /** Key of the name under `welcome.sample.people`. */
  name: "comedor" | "rosa" | "pedro" | "carlos" | "elSol" | "lacteos" | "centro";
  minorUnits: string;
  /** Days from today: negative when it fell due in the past. */
  dueInDays: number;
};

/** The customers who owe the most, overdue first, as the home's "Por cobrar" card lists them. */
export const EXAMPLE_DEBTORS: readonly ExampleBalance[] = [
  { name: "comedor", minorUnits: "31050", dueInDays: -38 },
  { name: "rosa", minorUnits: "21250", dueInDays: -12 },
  { name: "pedro", minorUnits: "8750", dueInDays: -66 },
];

/** Open supplier purchases, the next one due first; they add up to `EXAMPLE_PAYABLES.outstanding`. */
export const EXAMPLE_CREDITORS: readonly (ExampleBalance & { invoice: string })[] = [
  { name: "elSol", minorUnits: "123900", dueInDays: 3, invoice: "F-1877" },
  { name: "lacteos", minorUnits: "61000", dueInDays: 10, invoice: "F-1902" },
  { name: "centro", minorUnits: "18600", dueInDays: 18, invoice: "F-1941" },
];

/** Only the first purchase falls due within the week; nothing is overdue. */
export const EXAMPLE_PAYABLES = {
  outstanding: "203500",
  purchases: 3,
  dueThisWeek: "123900",
} as const;

/**
 * The six complete months before the current one. A month in progress would need figures that
 * follow the day of the month to stay believable next to today's movements.
 */
const CASH_FLOW = [
  { inflow: "1048000", outflow: "962000" },
  { inflow: "1123000", outflow: "1018000" },
  { inflow: "1086000", outflow: "1041000" },
  { inflow: "1194000", outflow: "1063000" },
  { inflow: "1252000", outflow: "1096000" },
  { inflow: "1218500", outflow: "1143250" },
] as const;

export function exampleCashFlow(today: string): CashFlowReport["months"] {
  let closing = 280000n;
  return CASH_FLOW.map((month, index) => {
    const net = BigInt(month.inflow) - BigInt(month.outflow);
    closing += net;
    return {
      month: shiftLocalMonth(today, index - CASH_FLOW.length),
      inflowMinorUnits: month.inflow,
      outflowMinorUnits: month.outflow,
      netMinorUnits: String(net),
      closingBalanceMinorUnits: String(closing),
    };
  });
}
