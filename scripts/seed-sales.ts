import {
  createCatalogRepository,
  createReceivablesRepository,
  createSalesRepository,
  type Database,
  type ProductActor,
} from "@pisto/db";

type Moment = { occurredLocalDate: string; occurredLocalTime: string };

/**
 * Counter sales with products for the demo business, posted through the same command as the app:
 * stock leaves the catalog, payments land in the accounts and the one balance becomes a debt.
 */
export async function seedItemizedSales(
  db: Database,
  owner: ProductActor,
  at: (daysAgo: number, time: string) => Moment,
): Promise<void> {
  const catalog = createCatalogRepository(db);
  const receivables = createReceivablesRepository(db);
  const sales = createSalesRepository(db);
  const products = await catalog.listProducts(owner, { limit: 50, status: "active" });
  const customers = await receivables.listCustomers(owner, { limit: 50, status: "active" });
  const { accounts } = await sales.getSaleFormOptions(owner);
  const need = <T>(value: T | undefined, label: string): T => {
    if (value === undefined) throw new Error(`The demo data has no ${label}`);
    return value;
  };
  const product = (name: string) =>
    need(products.items.find((item) => item.product.name === name)?.product.id, name);
  const customer = (name: string) =>
    need(customers.items.find((item) => item.name === name)?.id, name);
  const account = (kind: "cash" | "bank") =>
    need(accounts.find((item) => item.kind === kind)?.id, `${kind} account`);
  const line = (name: string, quantity: string) => ({
    productId: product(name),
    quantityMinorUnits: quantity,
  });

  await sales.createItemizedSale(owner, {
    idempotencyKey: crypto.randomUUID(),
    ...at(0, "10:20"),
    lines: [line("Coca-Cola 600 ml", "2"), line("Arroz San Pedro 1 lb", "3")],
    payment: { method: "cash", accountId: account("cash"), receivedMinorUnits: "535" },
  });
  await sales.createItemizedSale(owner, {
    idempotencyKey: crypto.randomUUID(),
    ...at(1, "14:05"),
    customerId: customer("Comedor El Pilar"),
    lines: [
      line("Aceite vegetal 750 ml", "2"),
      line("Frijol rojo 1 lb", "2"),
      line("Arroz San Pedro 1 lb", "4"),
    ],
    payment: { method: "transfer", accountId: account("bank"), receivedMinorUnits: "500" },
    // Two weeks after today, in business-local days.
    dueDate: at(-14, "00:00").occurredLocalDate,
  });
  await sales.createItemizedSale(owner, {
    idempotencyKey: crypto.randomUUID(),
    ...at(2, "09:40"),
    customerId: customer("Rosa Ayala"),
    lines: [line("Jabón en barra", "3"), line("Agua Cristal 1 L", "2")],
    payment: { method: "card", accountId: account("bank"), receivedMinorUnits: "330" },
  });
  console.info("Added 3 itemized sales with stock, payments and one balance on credit.");
}
