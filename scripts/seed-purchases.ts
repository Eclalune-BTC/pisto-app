/**
 * Demo suppliers and purchases for the freshly created seed business: purchases on credit, one
 * overdue, one paid off, one paid on the spot and one waiting for its merchandise. Everything goes
 * through the repositories, so stock, cash and operation receipts stay consistent.
 */
import {
  createCashRepository,
  createCatalogRepository,
  createPurchasesRepository,
  type Database,
  type ProductActor,
} from "@pisto/db";

import { localDate } from "./seed.ts";

const key = () => crypto.randomUUID();

export async function seedPurchases(input: {
  db: Database;
  owner: ProductActor;
  now: Date;
}): Promise<void> {
  const { db, owner, now } = input;
  const catalog = createCatalogRepository(db);
  const cash = createCashRepository(db);
  const purchases = createPurchasesRepository(db);
  const day = (daysAgo: number) => localDate(now, daysAgo);

  const { items: products } = await catalog.listProducts(owner, { limit: 50, status: "active" });
  const productBySku = new Map(products.map(({ product }) => [product.sku, product.id]));
  const sku = (value: string) => {
    const id = productBySku.get(value);
    if (!id) throw new Error(`Seed product ${value} is missing`);
    return id;
  };
  const { items: accounts } = await cash.listAccounts(owner, { limit: 50, status: "active" });
  const account = (name: string) => {
    const found = accounts.find((entry) => entry.name === name);
    if (!found) throw new Error(`Seed account ${name} is missing`);
    return found.id;
  };
  const till = account("Caja principal");
  const bank = account("Banco Agrícola");
  const { product: cheese } = await catalog.createProduct(owner, {
    idempotencyKey: key(),
    name: "Queso duro 1 lb",
    unitKind: "unit",
    quantityPrecision: 0,
    tracked: true,
    categoryId: null,
    sku: "LAC-001",
    sellingPriceMinorUnits: "450",
    lowStockThresholdMinorUnits: "5",
  });

  const supplier = async (fields: {
    name: string;
    contactName: string;
    phone: string;
    email?: string;
    taxId?: string;
    creditDays: number;
    notes: string;
  }) => (await purchases.createSupplier(owner, { idempotencyKey: key(), ...fields })).supplier.id;
  const elSol = await supplier({
    name: "Abarrotes Mayoreo El Sol",
    contactName: "Mario Hernández",
    phone: "2213-4580",
    email: "ventas@elsolmayoreo.com",
    taxId: "0614-120318-102-5",
    creditDays: 15,
    notes: "Granos básicos, aceite y azúcar",
  });
  const sanJulian = await supplier({
    name: "Lácteos San Julián",
    contactName: "Silvia Pérez",
    phone: "7012-3366",
    creditDays: 15,
    notes: "Quesos, crema y leche",
  });
  const centro = await supplier({
    name: "Distribuidora Centro",
    contactName: "Kevin Ramos",
    phone: "2260-7711",
    taxId: "0614-250719-103-1",
    creditDays: 14,
    notes: "Gaseosas, agua y jugos",
  });

  const overdue = await purchases.createPurchase(owner, {
    idempotencyKey: key(),
    supplierId: elSol,
    invoiceNumber: "F-1820",
    occurredLocalDate: day(20),
    occurredLocalTime: "10:15",
    lines: [
      { productId: sku("ABA-001"), quantityMinorUnits: "50", unitCostMinorUnits: "70" },
      { productId: sku("ABA-002"), quantityMinorUnits: "40", unitCostMinorUnits: "95" },
      { productId: sku("ABA-003"), quantityMinorUnits: "24", unitCostMinorUnits: "210" },
    ],
    received: true,
    paymentTerms: "credit",
    dueDate: day(5),
  });
  await purchases.createSupplierPayment(owner, overdue.purchase.id, {
    idempotencyKey: key(),
    accountId: till,
    amountMinorUnits: "4000",
    occurredLocalDate: day(6),
    occurredLocalTime: "16:30",
    reference: "Abono en efectivo",
  });

  const settled = await purchases.createPurchase(owner, {
    idempotencyKey: key(),
    supplierId: sanJulian,
    invoiceNumber: "F-0457",
    occurredLocalDate: day(15),
    occurredLocalTime: "08:40",
    lines: [{ productId: cheese.id, quantityMinorUnits: "20", unitCostMinorUnits: "320" }],
    received: true,
    paymentTerms: "credit",
    dueDate: day(0),
  });
  await purchases.createSupplierPayment(owner, settled.purchase.id, {
    idempotencyKey: key(),
    accountId: bank,
    amountMinorUnits: "6400",
    occurredLocalDate: day(2),
    occurredLocalTime: "11:00",
    reference: "Transferencia 88213",
  });

  await purchases.createPurchase(owner, {
    idempotencyKey: key(),
    supplierId: centro,
    invoiceNumber: "F-004512",
    occurredLocalDate: day(3),
    occurredLocalTime: "09:20",
    lines: [
      { productId: sku("BEB-001"), quantityMinorUnits: "48", unitCostMinorUnits: "80" },
      { productId: sku("BEB-002"), quantityMinorUnits: "36", unitCostMinorUnits: "45" },
    ],
    received: true,
    paymentTerms: "credit",
    dueDate: day(-4),
  });

  await purchases.createPurchase(owner, {
    idempotencyKey: key(),
    supplierId: elSol,
    invoiceNumber: "F-1877",
    occurredLocalDate: day(2),
    occurredLocalTime: "14:05",
    lines: [{ productId: sku("LIM-001"), quantityMinorUnits: "24", unitCostMinorUnits: "38" }],
    received: true,
    paymentTerms: "cash",
    accountId: till,
  });

  await purchases.createPurchase(owner, {
    idempotencyKey: key(),
    supplierId: centro,
    invoiceNumber: "F-004530",
    occurredLocalDate: day(0),
    occurredLocalTime: "08:10",
    lines: [{ productId: sku("BEB-001"), quantityMinorUnits: "24", unitCostMinorUnits: "80" }],
    received: false,
    paymentTerms: "credit",
    dueDate: day(-14),
  });
}
