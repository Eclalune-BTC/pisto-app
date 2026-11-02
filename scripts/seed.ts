#!/usr/bin/env bun
/**
 * Loads demo users with preconfigured roles and a realistic business into the configured
 * database. Data goes through the same repositories as the API, so every record keeps its
 * operation receipt. Re-running is safe: users and memberships are reused, and business data is
 * only written the first time the demo business is created.
 */
import {
  createBusinessRepository,
  createCashRepository,
  createCatalogRepository,
  createReceivablesRepository,
  createSalesRepository,
  member,
  type ProductActor,
  session,
  user,
} from "@pisto/db";
import { eq } from "drizzle-orm";

import { createRuntime } from "../apps/api/src/runtime.ts";

export const demoUsers = [
  { role: "owner", name: "Marta López", email: "dueno@pisto.test" },
  { role: "admin", name: "Carlos Rivas", email: "encargado@pisto.test" },
  { role: "member", name: "Ana Guzmán", email: "vendedor@pisto.test" },
] as const;

export const demoBusiness = {
  name: "Abarrotes La Ceiba",
  currency: "USD",
  timeZone: "America/El_Salvador",
} as const;

/** The business-local date `daysAgo` days before `now`; El Salvador is UTC-6 all year. */
export function localDate(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - 6 * 3_600_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function seedPassword(env: Record<string, string | undefined>): string {
  const password = env.SEED_PASSWORD ?? "PistoDemo2026";
  if (password.length < 8) throw new Error("SEED_PASSWORD must contain at least 8 characters");
  return password;
}

const key = () => crypto.randomUUID();

async function main() {
  const runtime = createRuntime(process.env);
  const { db } = runtime.database;
  const password = seedPassword(process.env);
  const now = new Date();

  try {
    /** Returns an actor with a fresh session, creating the account the first time. */
    async function actorFor(demo: (typeof demoUsers)[number]): Promise<ProductActor> {
      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, demo.email));
      const result = existing
        ? await runtime.auth.api.signInEmail({ body: { email: demo.email, password } })
        : await runtime.auth.api.signUpEmail({
            body: { name: demo.name, email: demo.email, password },
          });
      if (!result.token) throw new Error(`No session was created for ${demo.email}`);
      const [created] = await db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.token, result.token));
      if (!created) throw new Error(`The session for ${demo.email} was not stored`);
      return { userId: result.user.id, sessionId: created.id, activeBusinessId: null };
    }

    const [ownerUser, ...staff] = demoUsers;
    const owner = await actorFor(ownerUser);
    const { business, replayed } = await createBusinessRepository(db).createBusiness(
      owner,
      demoBusiness,
    );
    owner.activeBusinessId = business.id;

    for (const demo of staff) {
      const actor = await actorFor(demo);
      await db
        .insert(member)
        .values({
          id: crypto.randomUUID(),
          organizationId: business.id,
          userId: actor.userId,
          role: demo.role,
        })
        .onConflictDoNothing({ target: [member.organizationId, member.userId] });
    }

    if (replayed) {
      console.info("Demo business already existed; users and roles were verified, no data added.");
      return;
    }

    const catalog = createCatalogRepository(db);
    const cash = createCashRepository(db);
    const receivables = createReceivablesRepository(db);
    const sales = createSalesRepository(db);
    const at = (daysAgo: number, time: string) => ({
      occurredLocalDate: localDate(now, daysAgo),
      occurredLocalTime: time,
    });

    const categories = new Map<string, string>();
    for (const name of ["Bebidas", "Abarrotes", "Limpieza"]) {
      const { category } = await catalog.createCategory(owner, { idempotencyKey: key(), name });
      categories.set(name, category.id);
    }
    const products = [
      {
        name: "Coca-Cola 600 ml",
        category: "Bebidas",
        sku: "BEB-001",
        price: "125",
        stock: "48",
        low: "12",
      },
      {
        name: "Agua Cristal 1 L",
        category: "Bebidas",
        sku: "BEB-002",
        price: "75",
        stock: "36",
        low: "10",
      },
      {
        name: "Arroz San Pedro 1 lb",
        category: "Abarrotes",
        sku: "ABA-001",
        price: "95",
        stock: "60",
        low: "15",
      },
      {
        name: "Frijol rojo 1 lb",
        category: "Abarrotes",
        sku: "ABA-002",
        price: "130",
        stock: "8",
        low: "10",
      },
      {
        name: "Aceite vegetal 750 ml",
        category: "Abarrotes",
        sku: "ABA-003",
        price: "285",
        stock: "20",
        low: "5",
      },
      {
        name: "Jabón en barra",
        category: "Limpieza",
        sku: "LIM-001",
        price: "60",
        stock: "30",
        low: "8",
      },
    ];
    for (const item of products) {
      const { product } = await catalog.createProduct(owner, {
        idempotencyKey: key(),
        name: item.name,
        unitKind: "unit",
        quantityPrecision: 0,
        tracked: true,
        categoryId: categories.get(item.category) ?? null,
        sku: item.sku,
        sellingPriceMinorUnits: item.price,
        lowStockThresholdMinorUnits: item.low,
      });
      await catalog.recordMovement(owner, product.id, {
        idempotencyKey: key(),
        action: "receive",
        quantityMinorUnits: item.stock,
        reason: "Inventario inicial",
        ...at(7, "07:30"),
      });
    }

    const { account: till } = await cash.createAccount(owner, {
      idempotencyKey: key(),
      name: "Caja principal",
      kind: "cash",
      allowNegativeBalance: false,
      currency: demoBusiness.currency,
      opening: {
        direction: "in",
        amountMinorUnits: "50000",
        reason: "Fondo inicial",
        ...at(7, "07:00"),
      },
    });
    await cash.createAccount(owner, {
      idempotencyKey: key(),
      name: "Banco Agrícola",
      kind: "bank",
      allowNegativeBalance: false,
      currency: demoBusiness.currency,
      opening: {
        direction: "in",
        amountMinorUnits: "200000",
        reason: "Saldo inicial",
        ...at(7, "07:00"),
      },
    });
    for (const expense of [
      {
        category: "utilities",
        amount: "4250",
        description: "Recibo de luz",
        payee: "CAESS",
        day: 5,
      },
      {
        category: "transport",
        amount: "1200",
        description: "Flete de mercadería",
        payee: "Transportes Díaz",
        day: 3,
      },
      {
        category: "inventory",
        amount: "8600",
        description: "Compra a Distribuidora Centro",
        payee: "Distribuidora Centro",
        day: 2,
      },
    ] as const) {
      await cash.postExpense(owner, {
        idempotencyKey: key(),
        accountId: till.id,
        category: expense.category,
        amountMinorUnits: expense.amount,
        currency: demoBusiness.currency,
        description: expense.description,
        payee: expense.payee,
        ...at(expense.day, "16:00"),
      });
    }

    for (const sale of [
      { amount: "1850", day: 6, time: "09:15", description: "Venta de mostrador" },
      { amount: "2425", day: 5, time: "11:40", description: "Venta de mostrador" },
      { amount: "975", day: 4, time: "08:05", description: "Venta de mostrador" },
      { amount: "4310", day: 3, time: "17:20", description: "Pedido de Comedor El Pilar" },
      { amount: "1560", day: 2, time: "10:30", description: "Venta de mostrador" },
      { amount: "3290", day: 1, time: "12:10", description: "Venta de mostrador" },
      { amount: "2140", day: 0, time: "08:45", description: "Venta de mostrador" },
    ]) {
      await sales.createSale(owner, {
        idempotencyKey: key(),
        grossMinorUnits: sale.amount,
        description: sale.description,
        ...at(sale.day, sale.time),
      });
    }

    const customers = [
      { name: "Rosa Ayala", phone: "+503 7012 3456", owed: "5475", paid: "2000", day: 6 },
      { name: "Comedor El Pilar", phone: "+503 2260 1122", owed: "12500", paid: null, day: 20 },
      { name: "Pedro Alvarado", phone: "+503 7788 9900", owed: "3250", paid: null, day: 1 },
    ];
    for (const entry of customers) {
      const { customer } = await receivables.createCustomer(owner, {
        idempotencyKey: key(),
        name: entry.name,
        phone: entry.phone,
      });
      const { receivable } = await receivables.postReceivable(owner, {
        idempotencyKey: key(),
        customerId: customer.id,
        originalMinorUnits: entry.owed,
        description: "Venta al crédito",
        postedDate: localDate(now, entry.day),
        dueDate: localDate(now, entry.day - 15),
      });
      if (entry.paid) {
        await receivables.applyPayment(owner, receivable.id, {
          idempotencyKey: key(),
          amountMinorUnits: entry.paid,
          cashAccountId: till.id,
          reference: "Abono en efectivo",
          ...at(entry.day - 2, "15:30"),
        });
      }
    }

    console.info(
      `Seeded ${demoBusiness.name}: ${demoUsers.length} users, ${products.length} products, 7 sales, 3 expenses, ${customers.length} receivables.`,
    );
  } finally {
    await runtime.database.close();
  }
}

if (import.meta.main) await main();
