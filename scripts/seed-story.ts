/**
 * Six weeks in the life of the demo store, planned without a database and then posted through the
 * same repositories as the API. The plan is deterministic for a given day, keeps stock and protected
 * cash balances from going negative, and ends in a state worth reviewing: customers who owe, one
 * debt overdue, supplier invoices due soon and overdue, products running low and one sold out.
 */
import type { ExpenseCategory, SalePaymentMethod } from "@pisto/contracts";
import {
  createCashRepository,
  createCatalogRepository,
  createPurchasesRepository,
  createReceivablesRepository,
  createSalesRepository,
  type Database,
  type ProductActor,
} from "@pisto/db";

export const STORY_DAYS = 42;

export type StoryActor = "owner" | "admin" | "seller";
export type StoryAccount = "till" | "bank";
export type StoryEntrySource = "manual" | "voice" | "text";

type Moment = { date: string; time: string };

export type StorySale = Moment & {
  kind: "sale";
  ref: string;
  actor: StoryActor;
  lines: { sku: string; quantity: number }[];
  customer: string | null;
  payment: { method: SalePaymentMethod; account: StoryAccount; received: number } | null;
  dueDate: string | null;
  entrySource: StoryEntrySource;
  total: number;
};

export type StoryPurchase = Moment & {
  kind: "purchase";
  ref: string;
  actor: StoryActor;
  supplier: string;
  invoice: string;
  lines: { sku: string; quantity: number; unitCost: number }[];
  terms: "cash" | "credit";
  account: StoryAccount | null;
  dueDate: string | null;
  entrySource: StoryEntrySource;
  total: number;
};

export type StoryEvent =
  | StorySale
  | StoryPurchase
  | (Moment & {
      kind: "supplierPayment";
      actor: StoryActor;
      purchaseRef: string;
      account: StoryAccount;
      amount: number;
      reference: string;
    })
  | (Moment & {
      kind: "receivablePayment";
      actor: StoryActor;
      saleRef: string;
      account: StoryAccount;
      amount: number;
      reference: string;
      entrySource: StoryEntrySource;
    })
  | (Moment & {
      kind: "expense";
      actor: StoryActor;
      account: StoryAccount;
      category: ExpenseCategory;
      amount: number;
      description: string;
      payee: string;
      entrySource: StoryEntrySource;
    })
  | (Moment & {
      kind: "transfer";
      actor: StoryActor;
      from: StoryAccount;
      to: StoryAccount;
      amount: number;
      note: string;
    });

export type StoryProduct = {
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  initial: number;
  low: number;
  supplier: string;
  /** Stock the weekly order refills to, rounded up to whole packs. */
  target: number;
  pack: number;
  weight: number;
  maxQuantity: number;
  /** Not reordered in the last weeks, so the review shows it low or sold out. */
  endState?: "low" | "out";
};

export const STORY_CATEGORIES = ["Bebidas", "Abarrotes", "Lácteos", "Limpieza"] as const;

export const STORY_PRODUCTS: readonly StoryProduct[] = [
  {
    sku: "BEB-001",
    name: "Coca-Cola 600 ml",
    category: "Bebidas",
    price: 125,
    cost: 82,
    initial: 48,
    low: 12,
    supplier: "Distribuidora Centro",
    target: 72,
    pack: 24,
    weight: 14,
    maxQuantity: 4,
  },
  {
    sku: "BEB-002",
    name: "Agua Cristal 1 L",
    category: "Bebidas",
    price: 75,
    cost: 46,
    initial: 36,
    low: 10,
    supplier: "Distribuidora Centro",
    target: 48,
    pack: 12,
    weight: 9,
    maxQuantity: 3,
  },
  {
    sku: "BEB-003",
    name: "Jugo Petit 330 ml",
    category: "Bebidas",
    price: 60,
    cost: 38,
    initial: 36,
    low: 10,
    supplier: "Distribuidora Centro",
    target: 48,
    pack: 24,
    weight: 7,
    maxQuantity: 3,
  },
  {
    sku: "ABA-001",
    name: "Arroz San Pedro 1 lb",
    category: "Abarrotes",
    price: 95,
    cost: 66,
    initial: 60,
    low: 15,
    supplier: "Abarrotes Mayoreo El Sol",
    target: 75,
    pack: 25,
    weight: 12,
    maxQuantity: 3,
  },
  {
    sku: "ABA-002",
    name: "Frijol rojo 1 lb",
    category: "Abarrotes",
    price: 130,
    cost: 92,
    initial: 40,
    low: 10,
    supplier: "Abarrotes Mayoreo El Sol",
    target: 50,
    pack: 25,
    weight: 11,
    maxQuantity: 3,
    endState: "low",
  },
  {
    sku: "ABA-003",
    name: "Aceite vegetal 750 ml",
    category: "Abarrotes",
    price: 285,
    cost: 205,
    initial: 20,
    low: 5,
    supplier: "Abarrotes Mayoreo El Sol",
    target: 24,
    pack: 12,
    weight: 5,
    maxQuantity: 1,
  },
  {
    sku: "ABA-004",
    name: "Azúcar blanca 1 lb",
    category: "Abarrotes",
    price: 65,
    cost: 44,
    initial: 50,
    low: 12,
    supplier: "Abarrotes Mayoreo El Sol",
    target: 60,
    pack: 25,
    weight: 8,
    maxQuantity: 3,
  },
  {
    sku: "ABA-005",
    name: "Café molido 1 lb",
    category: "Abarrotes",
    price: 325,
    cost: 235,
    initial: 15,
    low: 4,
    supplier: "Abarrotes Mayoreo El Sol",
    target: 18,
    pack: 6,
    weight: 3,
    maxQuantity: 1,
  },
  {
    sku: "ABA-006",
    name: "Harina de maíz 1 lb",
    category: "Abarrotes",
    price: 80,
    cost: 54,
    initial: 40,
    low: 10,
    supplier: "Abarrotes Mayoreo El Sol",
    target: 60,
    pack: 25,
    weight: 6,
    maxQuantity: 3,
  },
  {
    sku: "LAC-001",
    name: "Queso duro 1 lb",
    category: "Lácteos",
    price: 450,
    cost: 315,
    initial: 12,
    low: 5,
    supplier: "Lácteos San Julián",
    target: 14,
    pack: 2,
    weight: 4,
    maxQuantity: 1,
  },
  {
    sku: "LAC-002",
    name: "Crema 1/2 lb",
    category: "Lácteos",
    price: 175,
    cost: 118,
    initial: 12,
    low: 4,
    supplier: "Lácteos San Julián",
    target: 16,
    pack: 4,
    weight: 4,
    maxQuantity: 2,
  },
  {
    sku: "LIM-001",
    name: "Jabón en barra",
    category: "Limpieza",
    price: 60,
    cost: 37,
    initial: 30,
    low: 8,
    supplier: "Productos de Limpieza La Fe",
    target: 36,
    pack: 12,
    weight: 4,
    maxQuantity: 2,
  },
  {
    sku: "LIM-002",
    name: "Detergente 500 g",
    category: "Limpieza",
    price: 175,
    cost: 118,
    initial: 18,
    low: 5,
    supplier: "Productos de Limpieza La Fe",
    target: 18,
    pack: 6,
    weight: 3,
    maxQuantity: 1,
    endState: "out",
  },
];

export const STORY_SUPPLIERS = [
  {
    name: "Distribuidora Centro",
    contactName: "Luis Pérez",
    phone: "2222-4510",
    email: "ventas@distribuidoracentro.com.sv",
    taxId: "0614-150310-102-5",
    creditDays: 15,
    notes: "Bebidas y jugos. Entrega los martes.",
  },
  {
    name: "Abarrotes Mayoreo El Sol",
    contactName: "Sofía Méndez",
    phone: "2260-7781",
    taxId: "0614-220715-104-1",
    creditDays: 30,
    notes: "Granos, aceite, azúcar y café. Pedido los lunes.",
  },
  {
    name: "Lácteos San Julián",
    contactName: "Raúl Hernández",
    phone: "7845-2210",
    creditDays: 0,
    notes: "Queso y crema. Se paga al recibir.",
  },
  {
    name: "Productos de Limpieza La Fe",
    contactName: "Marina Ortiz",
    phone: "2298-3344",
    creditDays: 15,
    notes: "Jabón y detergente cada dos semanas.",
  },
] as const;

export const STORY_CUSTOMERS = [
  {
    name: "Comedor El Pilar",
    phone: "2260-1122",
    notes: "Pedido grande los miércoles; paga a 15 días.",
  },
  {
    name: "Pupusería Doña Tere",
    phone: "7123-4567",
    notes: "Lleva harina y queso los sábados; paga el lunes.",
  },
  { name: "Rosa Ayala", phone: "7012-3456" },
  { name: "Pedro Alvarado", phone: "7788-9900" },
  { name: "Carmen Flores", phone: "7654-3210" },
] as const;

export const STORY_OPENING = { till: 15_000, bank: 180_000 } as const;

/** A small deterministic generator, so the same day always produces the same story. */
function generator(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly { value: T; weight: number }[]): T => {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      let roll = next() * total;
      for (const item of items) {
        roll -= item.weight;
        if (roll < 0) return item.value;
      }
      const last = items.at(-1);
      if (!last) throw new Error("Nothing to pick from");
      return last.value;
    },
  };
}

/** Business-local calendar date `daysAgo` days before `now` (El Salvador is UTC-6 all year). */
export function storyDate(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - 6 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function weekday(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function minutes(time: string): number {
  const [hours = "0", mins = "0"] = time.split(":");
  return Number(hours) * 60 + Number(mins);
}

function clock(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const productBySku = new Map(STORY_PRODUCTS.map((product) => [product.sku, product]));
function product(sku: string): StoryProduct {
  const found = productBySku.get(sku);
  if (!found) throw new Error(`Unknown story product ${sku}`);
  return found;
}

export type DemoStory = {
  startDate: string;
  events: StoryEvent[];
  finalStock: Record<string, number>;
  finalBalances: Record<StoryAccount, number>;
};

/**
 * Plans every record of the story in order. Amounts are integer cents; quantities are whole units.
 * Records dated today stop at `now`, so nothing is posted in the future.
 */
export function planDemoStory(now: Date): DemoStory {
  const random = generator(20261103);
  const today = storyDate(now, 0);
  const nowMinutes = minutes(new Date(now.getTime() - 6 * 3_600_000).toISOString().slice(11, 16));
  const startDate = storyDate(now, STORY_DAYS);
  const stock = new Map(STORY_PRODUCTS.map((item) => [item.sku, item.initial]));
  const balances: Record<StoryAccount, number> = { ...STORY_OPENING };
  const events: StoryEvent[] = [];
  const receivables = new Map<string, { customer: string; balance: number; dueDate: string }>();
  const payables = new Map<string, { supplier: string; balance: number; invoice: string }>();
  const invoices = new Map<string, number>([
    ["Distribuidora Centro", 4510],
    ["Abarrotes Mayoreo El Sol", 1795],
    ["Lácteos San Julián", 231],
    ["Productos de Limpieza La Fe", 860],
  ]);
  let refs = 0;
  const nextRef = (prefix: string) => `${prefix}-${++refs}`;
  const lastWeeks = (date: string, days: number) =>
    Date.parse(today) - Date.parse(date) < days * 86_400_000;

  const pickSource = (): StoryEntrySource =>
    random.pick([
      { value: "manual" as const, weight: 72 },
      { value: "voice" as const, weight: 21 },
      { value: "text" as const, weight: 7 },
    ]);

  const invoiceFor = (supplier: string) => {
    const number = (invoices.get(supplier) ?? 100) + 1;
    invoices.set(supplier, number);
    if (supplier === "Distribuidora Centro") return `F-00${number}`;
    if (supplier === "Lácteos San Julián") return `SJ-${number}`;
    if (supplier === "Productos de Limpieza La Fe") return `LF-${number}`;
    return `F-${number}`;
  };

  /** Lines whose stock allows them; a product kept for the review's end state keeps a floor. */
  const available = (sku: string, wanted: number, date: string) => {
    const item = product(sku);
    const floor = item.endState === "low" && lastWeeks(date, 17) ? 6 : 0;
    return Math.max(0, Math.min(wanted, (stock.get(sku) ?? 0) - floor));
  };
  const total = (lines: { sku: string; quantity: number }[]) =>
    lines.reduce((sum, line) => sum + product(line.sku).price * line.quantity, 0);

  const pushSale = (sale: Omit<StorySale, "kind" | "ref" | "total">): StorySale | null => {
    const lines = sale.lines
      .map((line) => ({ sku: line.sku, quantity: available(line.sku, line.quantity, sale.date) }))
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) return null;
    const amount = total(lines);
    let payment = sale.payment;
    if (payment) {
      const received = Math.min(payment.received, amount);
      payment = received > 0 ? { ...payment, received } : null;
    }
    const credit = amount - (payment?.received ?? 0);
    if (credit > 0 && (!sale.customer || !sale.dueDate)) {
      // A walk-in customer always pays everything.
      payment = {
        method: payment?.method ?? "cash",
        account: payment?.account ?? "till",
        received: amount,
      };
    }
    for (const line of lines) stock.set(line.sku, (stock.get(line.sku) ?? 0) - line.quantity);
    if (payment) balances[payment.account] += payment.received;
    const remaining = amount - (payment?.received ?? 0);
    const event: StorySale = {
      ...sale,
      kind: "sale",
      ref: nextRef("sale"),
      lines,
      payment,
      dueDate: remaining > 0 ? sale.dueDate : null,
      total: amount,
    };
    if (remaining > 0 && sale.customer && sale.dueDate) {
      receivables.set(event.ref, {
        customer: sale.customer,
        balance: remaining,
        dueDate: sale.dueDate,
      });
    }
    events.push(event);
    return event;
  };

  const pushPurchase = (
    date: string,
    time: string,
    supplier: string,
    terms: "cash" | "credit",
    creditDays: number,
  ) => {
    const lines = STORY_PRODUCTS.filter((item) => item.supplier === supplier)
      .filter((item) => !(item.endState && lastWeeks(date, 17)))
      .map((item) => {
        const missing = item.target - (stock.get(item.sku) ?? 0);
        const quantity = missing <= 0 ? 0 : Math.ceil(missing / item.pack) * item.pack;
        return { sku: item.sku, quantity, unitCost: item.cost };
      })
      .filter((line) => line.quantity > 0);
    if (lines.length === 0) return null;
    const amount = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    let account: StoryAccount | null = null;
    if (terms === "cash") {
      account = balances.till >= amount + 2_000 ? "till" : "bank";
      balances[account] -= amount;
    }
    for (const line of lines) stock.set(line.sku, (stock.get(line.sku) ?? 0) + line.quantity);
    const event: StoryPurchase = {
      kind: "purchase",
      ref: nextRef("purchase"),
      date,
      time,
      actor: random.next() < 0.6 ? "owner" : "admin",
      supplier,
      invoice: invoiceFor(supplier),
      lines,
      terms,
      account,
      dueDate: terms === "credit" ? addDays(date, creditDays) : null,
      entrySource: random.next() < 0.15 ? "voice" : "manual",
      total: amount,
    };
    if (terms === "credit")
      payables.set(event.ref, { supplier, balance: amount, invoice: event.invoice });
    events.push(event);
    return event;
  };

  const payExpense = (
    date: string,
    time: string,
    fields: {
      category: ExpenseCategory;
      amount: number;
      description: string;
      payee: string;
      preferred: StoryAccount;
      entrySource?: StoryEntrySource;
    },
  ) => {
    const account =
      fields.preferred === "till" && balances.till < fields.amount + 1_000
        ? "bank"
        : fields.preferred;
    if (balances[account] < fields.amount) return;
    balances[account] -= fields.amount;
    events.push({
      kind: "expense",
      date,
      time,
      actor: random.next() < 0.5 ? "owner" : "admin",
      account,
      category: fields.category,
      amount: fields.amount,
      description: fields.description,
      payee: fields.payee,
      entrySource: fields.entrySource ?? "manual",
    });
  };

  // Scheduled settlements, keyed by date: [time, action].
  const scheduled = new Map<string, { time: string; run: () => void }[]>();
  const schedule = (date: string, time: string, run: () => void) => {
    const list = scheduled.get(date) ?? [];
    list.push({ time, run });
    scheduled.set(date, list);
  };
  const payReceivable = (
    date: string,
    time: string,
    saleRef: string,
    share: number,
    account: StoryAccount,
    reference: string,
  ) => {
    const open = receivables.get(saleRef);
    if (!open || open.balance <= 0) return;
    const amount =
      share >= 1 ? open.balance : Math.max(100, Math.round((open.balance * share) / 100) * 100);
    const paid = Math.min(amount, open.balance);
    open.balance -= paid;
    balances[account] += paid;
    events.push({
      kind: "receivablePayment",
      date,
      time,
      actor: "admin",
      saleRef,
      account,
      amount: paid,
      reference,
      entrySource: random.next() < 0.3 ? "voice" : "manual",
    });
  };
  const paySupplier = (
    date: string,
    time: string,
    purchaseRef: string,
    share: number,
    reference: string,
  ) => {
    const open = payables.get(purchaseRef);
    if (!open || open.balance <= 0) return;
    const amount = share >= 1 ? open.balance : Math.round((open.balance * share) / 100) * 100;
    if (amount <= 0 || balances.bank < amount) return;
    open.balance -= amount;
    balances.bank -= amount;
    events.push({
      kind: "supplierPayment",
      date,
      time,
      actor: "owner",
      purchaseRef,
      account: "bank",
      amount,
      reference,
    });
  };

  const weighted = STORY_PRODUCTS.map((item) => ({ value: item.sku, weight: item.weight }));

  for (let daysAgo = STORY_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const date = storyDate(now, daysAgo);
    const day = weekday(date);
    const dayOfMonth = Number(date.slice(8, 10));
    type Planned = { time: string; run: () => void };
    const planned: Planned[] = [...(scheduled.get(date) ?? [])];

    // Morning orders from suppliers, before the store gets busy.
    if (day === 1) {
      planned.push({
        time: "07:40",
        run: () => {
          const purchase = pushPurchase(date, "07:40", "Abarrotes Mayoreo El Sol", "credit", 30);
          if (!purchase) return;
          // Paid on its due date, except the invoice that fell due last week: half of it is paid
          // and the rest is overdue, so the review always has one late invoice and one due soon.
          const due = addDays(date, 30);
          const share = due >= addDays(today, -8) && due <= addDays(today, -2) ? 0.5 : 1;
          schedule(due, "10:15", () =>
            paySupplier(due, "10:15", purchase.ref, share, `Transferencia ${purchase.invoice}`),
          );
        },
      });
      planned.push({
        time: "08:20",
        run: () =>
          payExpense(date, "08:20", {
            category: "transport",
            amount: random.int(10, 15) * 100,
            description: "Flete de mercadería",
            payee: "Transportes Díaz",
            preferred: "till",
          }),
      });
    }
    if (day === 2) {
      planned.push({
        time: "08:50",
        run: () => {
          const purchase = pushPurchase(date, "08:50", "Distribuidora Centro", "credit", 15);
          if (purchase)
            schedule(addDays(date, 13), "11:30", () =>
              paySupplier(
                addDays(date, 13),
                "11:30",
                purchase.ref,
                1,
                `Transferencia ${purchase.invoice}`,
              ),
            );
        },
      });
    }
    if (day === 4) {
      planned.push({
        time: "08:30",
        run: () => pushPurchase(date, "08:30", "Lácteos San Julián", "cash", 0),
      });
    }
    if (day === 5 && Math.floor(daysAgo / 7) % 2 === 0) {
      planned.push({
        time: "10:10",
        run: () => {
          const purchase = pushPurchase(date, "10:10", "Productos de Limpieza La Fe", "credit", 15);
          if (purchase)
            schedule(addDays(date, 12), "15:40", () =>
              paySupplier(
                addDays(date, 12),
                "15:40",
                purchase.ref,
                1,
                `Transferencia ${purchase.invoice}`,
              ),
            );
        },
      });
    }

    // Monthly bills.
    if (dayOfMonth === 1)
      planned.push({
        time: "09:15",
        run: () =>
          payExpense(date, "09:15", {
            category: "rent",
            amount: 25_000,
            description: "Alquiler del local",
            payee: "Julio Ramírez",
            preferred: "bank",
          }),
      });
    if (dayOfMonth === 5)
      planned.push({
        time: "14:30",
        run: () =>
          payExpense(date, "14:30", {
            category: "utilities",
            amount: 2_500,
            description: "Internet y teléfono",
            payee: "Tigo",
            preferred: "bank",
          }),
      });
    if (dayOfMonth === 10)
      planned.push({
        time: "12:05",
        run: () =>
          payExpense(date, "12:05", {
            category: "other",
            amount: 750,
            description: "Bolsas y empaques",
            payee: "Plásticos Santa Ana",
            preferred: "till",
          }),
      });
    if (dayOfMonth === 15)
      planned.push({
        time: "16:10",
        run: () =>
          payExpense(date, "16:10", {
            category: "utilities",
            amount: 1_140,
            description: "Recibo de agua",
            payee: "ANDA",
            preferred: "till",
            entrySource: "voice",
          }),
      });
    if (dayOfMonth === 20)
      planned.push({
        time: "11:00",
        run: () =>
          payExpense(date, "11:00", {
            category: "utilities",
            amount: random.int(4_300, 4_700),
            description: "Recibo de luz",
            payee: "CAESS",
            preferred: "bank",
            entrySource: "voice",
          }),
      });

    // Regular customers on credit.
    if (day === 3) {
      planned.push({
        time: "10:30",
        run: () => {
          const sale = pushSale({
            date,
            time: "10:30",
            actor: "admin",
            customer: "Comedor El Pilar",
            entrySource: random.next() < 0.5 ? "voice" : "manual",
            lines: [
              { sku: "ABA-001", quantity: random.int(8, 12) },
              { sku: "ABA-002", quantity: random.int(4, 6) },
              { sku: "ABA-003", quantity: random.int(2, 3) },
              { sku: "ABA-004", quantity: random.int(5, 8) },
              { sku: "LAC-001", quantity: 2 },
              { sku: "BEB-001", quantity: random.int(6, 12) },
            ],
            payment: { method: "transfer", account: "bank", received: 1_500 },
            dueDate: addDays(date, 15),
          });
          if (!sale) return;
          // The comedor settles a week later; the order from four weeks ago is left half paid and
          // goes overdue.
          const share = daysAgo >= 26 && daysAgo <= 32 ? 0.5 : 1;
          schedule(addDays(date, 8), "15:20", () =>
            payReceivable(
              addDays(date, 8),
              "15:20",
              sale.ref,
              share,
              "bank",
              "Transferencia del comedor",
            ),
          );
        },
      });
    }
    if (day === 6) {
      planned.push({
        time: "08:40",
        run: () => {
          const sale = pushSale({
            date,
            time: "08:40",
            actor: "seller",
            customer: "Pupusería Doña Tere",
            entrySource: "manual",
            lines: [
              { sku: "ABA-006", quantity: random.int(8, 12) },
              { sku: "LAC-001", quantity: 1 },
              { sku: "LAC-002", quantity: 2 },
              { sku: "ABA-003", quantity: 1 },
            ],
            payment: null,
            dueDate: addDays(date, 7),
          });
          if (sale)
            schedule(addDays(date, 2), "16:45", () =>
              payReceivable(addDays(date, 2), "16:45", sale.ref, 1, "till", "Pago en efectivo"),
            );
        },
      });
    }
    if (daysAgo % 10 === 3) {
      planned.push({
        time: "17:10",
        run: () => {
          const sale = pushSale({
            date,
            time: "17:10",
            actor: "seller",
            customer: "Rosa Ayala",
            entrySource: "voice",
            lines: [
              { sku: "ABA-005", quantity: 1 },
              { sku: "ABA-004", quantity: 2 },
              { sku: "LIM-001", quantity: 2 },
            ],
            payment: { method: "cash", account: "till", received: 300 },
            dueDate: addDays(date, 10),
          });
          if (sale)
            schedule(addDays(date, 6), "18:05", () =>
              payReceivable(addDays(date, 6), "18:05", sale.ref, 1, "till", "Abono en efectivo"),
            );
        },
      });
    }
    if (daysAgo === 24) {
      planned.push({
        time: "13:25",
        run: () => {
          pushSale({
            date,
            time: "13:25",
            actor: "seller",
            customer: "Pedro Alvarado",
            entrySource: "manual",
            lines: [
              { sku: "ABA-003", quantity: 2 },
              { sku: "ABA-002", quantity: 3 },
              { sku: "BEB-001", quantity: 6 },
              { sku: "LIM-002", quantity: 1 },
            ],
            payment: null,
            dueDate: addDays(date, 15),
          });
        },
      });
    }

    // Walk-in customers through the day.
    const tickets =
      day === 6 ? random.int(10, 13) : day === 0 ? random.int(5, 7) : random.int(7, 10);
    const times = new Set<number>();
    while (times.size < tickets) times.add(random.int(7 * 60 + 5, 19 * 60 + 40));
    for (const at of times) {
      const time = clock(at);
      planned.push({
        time,
        run: () => {
          const count = random.pick([
            { value: 1, weight: 30 },
            { value: 2, weight: 34 },
            { value: 3, weight: 24 },
            { value: 4, weight: 12 },
          ]);
          const skus = new Set<string>();
          while (skus.size < count) skus.add(random.pick(weighted));
          const method = random.pick([
            { value: "cash" as const, weight: 72 },
            { value: "transfer" as const, weight: 17 },
            { value: "card" as const, weight: 11 },
          ]);
          pushSale({
            date,
            time,
            actor: random.pick([
              { value: "seller" as const, weight: 56 },
              { value: "admin" as const, weight: 26 },
              { value: "owner" as const, weight: 18 },
            ]),
            customer: random.next() < 0.08 ? "Carmen Flores" : null,
            entrySource: pickSource(),
            lines: [...skus].map((sku) => ({
              sku,
              quantity: random.int(1, product(sku).maxQuantity),
            })),
            payment: {
              method,
              account: method === "cash" ? "till" : "bank",
              received: Number.MAX_SAFE_INTEGER,
            },
            dueDate: null,
          });
        },
      });
    }

    // The sold-out product goes with the last customer who asks for it.
    if (daysAgo === 2) {
      planned.push({
        time: "18:20",
        run: () => {
          const left = stock.get("LIM-002") ?? 0;
          if (left > 0) {
            pushSale({
              date,
              time: "18:20",
              actor: "seller",
              customer: "Carmen Flores",
              entrySource: "manual",
              lines: [
                { sku: "LIM-002", quantity: left },
                { sku: "LIM-001", quantity: 2 },
              ],
              payment: { method: "cash", account: "till", received: Number.MAX_SAFE_INTEGER },
              dueDate: null,
            });
          }
        },
      });
    }

    // Saturday evening: pay the helper and take the week's cash to the bank.
    if (day === 6) {
      planned.push({
        time: "18:30",
        run: () =>
          payExpense(date, "18:30", {
            category: "payroll",
            amount: 5_000,
            description: "Pago semanal de ayudante",
            payee: "José Martínez",
            preferred: "till",
          }),
      });
      planned.push({
        time: "19:15",
        run: () => {
          const amount = Math.floor((balances.till - 10_000) / 500) * 500;
          if (amount <= 0) return;
          balances.till -= amount;
          balances.bank += amount;
          events.push({
            kind: "transfer",
            date,
            time: "19:15",
            actor: "owner",
            from: "till",
            to: "bank",
            amount,
            note: "Depósito semanal",
          });
        },
      });
    }

    planned.sort((left, right) => minutes(left.time) - minutes(right.time));
    for (const entry of planned) {
      if (daysAgo === 0 && minutes(entry.time) > nowMinutes) continue;
      entry.run();
    }
  }

  return {
    startDate,
    events,
    finalStock: Object.fromEntries(stock),
    finalBalances: { ...balances },
  };
}

export type StoryActors = Record<StoryActor, ProductActor>;

/** Creates the catalog, accounts and contacts, then posts every planned record in order. */
export async function applyDemoStory(input: {
  db: Database;
  actors: StoryActors;
  currency: string;
  story: DemoStory;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ sales: number; purchases: number; expenses: number; payments: number }> {
  const { db, actors, currency, story } = input;
  const owner = actors.owner;
  const catalog = createCatalogRepository(db);
  const cash = createCashRepository(db);
  const purchases = createPurchasesRepository(db);
  const receivables = createReceivablesRepository(db);
  const sales = createSalesRepository(db);
  const key = () => crypto.randomUUID();
  const opening = { occurredLocalDate: story.startDate, occurredLocalTime: "07:00" };

  const categories = new Map<string, string>();
  for (const name of STORY_CATEGORIES) {
    const { category } = await catalog.createCategory(owner, { idempotencyKey: key(), name });
    categories.set(name, category.id);
  }
  const products = new Map<string, string>();
  for (const item of STORY_PRODUCTS) {
    const { product: created } = await catalog.createProduct(owner, {
      idempotencyKey: key(),
      name: item.name,
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: true,
      categoryId: categories.get(item.category) ?? null,
      sku: item.sku,
      sellingPriceMinorUnits: String(item.price),
      lowStockThresholdMinorUnits: String(item.low),
    });
    products.set(item.sku, created.id);
    await catalog.recordMovement(owner, created.id, {
      idempotencyKey: key(),
      action: "receive",
      quantityMinorUnits: String(item.initial),
      reason: "Inventario inicial",
      occurredLocalDate: story.startDate,
      occurredLocalTime: "07:30",
    });
  }
  const { account: till } = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Caja principal",
    kind: "cash",
    allowNegativeBalance: false,
    currency,
    opening: {
      direction: "in",
      amountMinorUnits: String(STORY_OPENING.till),
      reason: "Fondo inicial",
      ...opening,
    },
  });
  const { account: bank } = await cash.createAccount(owner, {
    idempotencyKey: key(),
    name: "Banco Agrícola",
    kind: "bank",
    allowNegativeBalance: false,
    currency,
    opening: {
      direction: "in",
      amountMinorUnits: String(STORY_OPENING.bank),
      reason: "Saldo inicial",
      ...opening,
    },
  });
  const accounts: Record<StoryAccount, string> = { till: till.id, bank: bank.id };
  const suppliers = new Map<string, string>();
  for (const entry of STORY_SUPPLIERS) {
    const { supplier } = await purchases.createSupplier(owner, { idempotencyKey: key(), ...entry });
    suppliers.set(entry.name, supplier.id);
  }
  const customers = new Map<string, string>();
  for (const entry of STORY_CUSTOMERS) {
    const { customer } = await receivables.createCustomer(owner, {
      idempotencyKey: key(),
      ...entry,
    });
    customers.set(entry.name, customer.id);
  }

  const need = <T>(value: T | undefined, label: string): T => {
    if (value === undefined) throw new Error(`The demo story has no ${label}`);
    return value;
  };
  const receivableBySale = new Map<string, string>();
  const purchaseIds = new Map<string, string>();
  const counts = { sales: 0, purchases: 0, expenses: 0, payments: 0 };
  let done = 0;

  for (const event of story.events) {
    const actor = actors[event.actor];
    const moment = { occurredLocalDate: event.date, occurredLocalTime: event.time };
    switch (event.kind) {
      case "sale": {
        const result = await sales.createItemizedSale(actor, {
          idempotencyKey: key(),
          ...moment,
          ...(event.customer
            ? { customerId: need(customers.get(event.customer), event.customer) }
            : {}),
          lines: event.lines.map((line) => ({
            productId: need(products.get(line.sku), line.sku),
            quantityMinorUnits: String(line.quantity),
          })),
          ...(event.payment
            ? {
                payment: {
                  method: event.payment.method,
                  accountId: accounts[event.payment.account],
                  receivedMinorUnits: String(event.payment.received),
                },
              }
            : {}),
          ...(event.dueDate ? { dueDate: event.dueDate } : {}),
          entrySource: event.entrySource,
        });
        if (result.sale.grossMinorUnits !== String(event.total)) {
          throw new Error(
            `Sale ${event.ref} totals ${result.sale.grossMinorUnits}, planned ${event.total}`,
          );
        }
        if (result.settlement.receivableId)
          receivableBySale.set(event.ref, result.settlement.receivableId);
        counts.sales += 1;
        break;
      }
      case "purchase": {
        const { purchase } = await purchases.createPurchase(actor, {
          idempotencyKey: key(),
          supplierId: need(suppliers.get(event.supplier), event.supplier),
          invoiceNumber: event.invoice,
          ...moment,
          lines: event.lines.map((line) => ({
            productId: need(products.get(line.sku), line.sku),
            quantityMinorUnits: String(line.quantity),
            unitCostMinorUnits: String(line.unitCost),
          })),
          received: true,
          paymentTerms: event.terms,
          ...(event.account ? { accountId: accounts[event.account] } : {}),
          ...(event.dueDate ? { dueDate: event.dueDate } : {}),
          entrySource: event.entrySource,
        });
        purchaseIds.set(event.ref, purchase.id);
        counts.purchases += 1;
        break;
      }
      case "supplierPayment":
        await purchases.createSupplierPayment(
          actor,
          need(purchaseIds.get(event.purchaseRef), event.purchaseRef),
          {
            idempotencyKey: key(),
            accountId: accounts[event.account],
            amountMinorUnits: String(event.amount),
            ...moment,
            reference: event.reference,
          },
        );
        counts.payments += 1;
        break;
      case "receivablePayment":
        await receivables.applyPayment(
          actor,
          need(receivableBySale.get(event.saleRef), event.saleRef),
          {
            idempotencyKey: key(),
            amountMinorUnits: String(event.amount),
            cashAccountId: accounts[event.account],
            reference: event.reference,
            ...moment,
            entrySource: event.entrySource,
          },
        );
        counts.payments += 1;
        break;
      case "expense":
        await cash.postExpense(actor, {
          idempotencyKey: key(),
          accountId: accounts[event.account],
          category: event.category,
          amountMinorUnits: String(event.amount),
          currency,
          description: event.description,
          payee: event.payee,
          ...moment,
          entrySource: event.entrySource,
        });
        counts.expenses += 1;
        break;
      case "transfer":
        await cash.transfer(actor, {
          idempotencyKey: key(),
          fromAccountId: accounts[event.from],
          toAccountId: accounts[event.to],
          amountMinorUnits: String(event.amount),
          currency,
          note: event.note,
          ...moment,
        });
        break;
    }
    done += 1;
    input.onProgress?.(done, story.events.length);
  }
  return counts;
}
