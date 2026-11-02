import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";

import {
  createAssistantDirectory,
  createBusinessRepository,
  createCashRepository,
  createCatalogRepository,
  createDatabase,
  member,
  organization,
  parseDatabaseConfig,
  session,
  user,
} from "../src/index.ts";
import { createReceivablesRepository } from "../src/receivables.ts";
import { businessSettings } from "../src/schema/business.ts";
import { cashMovement, cashOperationReceipt } from "../src/schema/cash.ts";
import { cashAccount } from "../src/schema/cash-account.ts";
import { catalogOperation, catalogProduct, inventoryMovement } from "../src/schema/catalog.ts";
import {
  customer,
  receivable,
  receivableOperation,
  receivablePayment,
} from "../src/schema/receivables.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 4 });
const directory = createAssistantDirectory(database.db);
const businesses = createBusinessRepository(database.db);
const catalog = createCatalogRepository(database.db);
const cash = createCashRepository(database.db);
const receivables = createReceivablesRepository(database.db);

const runId = crypto.randomUUID();
const userIds = {
  ownerA: `assistant-owner-a-${runId}`,
  ownerB: `assistant-owner-b-${runId}`,
  member: `assistant-member-${runId}`,
  outsider: `assistant-outsider-${runId}`,
};
const sessionIds = Object.fromEntries(
  Object.keys(userIds).map((name) => [name, `assistant-session-${name}-${runId}`]),
) as Record<keyof typeof userIds, string>;
const businessIds: string[] = [];
let businessA = "";
let businessB = "";
let anaId = "";
let openReceivableId = "";

const actor = (name: keyof typeof userIds, businessId: string) => ({
  userId: userIds[name],
  sessionId: sessionIds[name],
  activeBusinessId: businessId,
});
const key = () => crypto.randomUUID();

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([name, id]) => ({
      id,
      name: `Assistant ${name}`,
      email: `assistant-${name}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    Object.entries(sessionIds).map(([name, id]) => ({
      id,
      token: `assistant-token-${name}-${runId}`,
      userId: userIds[name as keyof typeof userIds],
      expiresAt: new Date(Date.now() + 30 * 60_000),
    })),
  );
  const createdA = await businesses.createBusiness(actor("ownerA", ""), {
    name: `Assistant Store A ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  const createdB = await businesses.createBusiness(actor("ownerB", ""), {
    name: `Assistant Store B ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  businessA = createdA.business.id;
  businessB = createdB.business.id;
  businessIds.push(businessA, businessB);
  await database.db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: businessA,
    userId: userIds.member,
    role: "member",
  });
  // A business session names its active business; the outsider points at one it does not belong to.
  await database.db
    .update(session)
    .set({ activeOrganizationId: businessA })
    .where(inArray(session.id, [sessionIds.member, sessionIds.outsider]));

  const ownerA = actor("ownerA", businessA);
  const ownerB = actor("ownerB", businessB);
  const coffee = await catalog.createProduct(ownerA, {
    idempotencyKey: key(),
    name: "Café molido 1 lb",
    unitKind: "unit",
    quantityPrecision: 0,
    tracked: true,
    sellingPriceMinorUnits: "325",
  });
  await catalog.recordMovement(ownerA, coffee.product.id, {
    idempotencyKey: key(),
    action: "receive",
    quantityMinorUnits: "12",
    reason: "Inventario inicial",
    occurredLocalDate: "2026-10-01",
    occurredLocalTime: "08:00",
  });
  const archived = await catalog.createProduct(ownerA, {
    idempotencyKey: key(),
    name: "Café de olla",
    unitKind: "unit",
    quantityPrecision: 0,
    tracked: false,
  });
  await catalog.archiveProduct(ownerA, archived.product.id, { idempotencyKey: key() });
  await catalog.createProduct(ownerB, {
    idempotencyKey: key(),
    name: "Café de la competencia",
    unitKind: "unit",
    quantityPrecision: 0,
    tracked: false,
  });

  const till = await cash.createAccount(ownerA, {
    idempotencyKey: key(),
    name: "Caja principal",
    kind: "cash",
    allowNegativeBalance: false,
    currency: "USD",
    opening: null,
  });
  await cash.createAccount(ownerB, {
    idempotencyKey: key(),
    name: "Caja ajena",
    kind: "cash",
    allowNegativeBalance: false,
    currency: "USD",
    opening: null,
  });

  const ana = await receivables.createCustomer(ownerA, {
    idempotencyKey: key(),
    name: "Ana Guzmán",
  });
  anaId = ana.customer.id;
  const paid = await receivables.postReceivable(ownerA, {
    idempotencyKey: key(),
    customerId: anaId,
    originalMinorUnits: "1000",
    description: "Fiado pagado",
    postedDate: "2026-09-01",
  });
  await receivables.applyPayment(ownerA, paid.receivable.id, {
    idempotencyKey: key(),
    amountMinorUnits: "1000",
    cashAccountId: till.account.id,
    occurredLocalDate: "2026-09-02",
    occurredLocalTime: "10:00",
  });
  const open = await receivables.postReceivable(ownerA, {
    idempotencyKey: key(),
    customerId: anaId,
    originalMinorUnits: "5475",
    description: "Venta al crédito",
    postedDate: "2026-09-10",
  });
  openReceivableId = open.receivable.id;
  await receivables.postReceivable(ownerA, {
    idempotencyKey: key(),
    customerId: anaId,
    originalMinorUnits: "800",
    description: "Venta más reciente",
    postedDate: "2026-10-10",
  });
  await receivables.createCustomer(ownerB, { idempotencyKey: key(), name: "Ana Ajena" });
});

afterAll(async () => {
  if (businessIds.length > 0) {
    await database.db.delete(cashMovement).where(inArray(cashMovement.businessId, businessIds));
    await database.db
      .delete(receivableOperation)
      .where(inArray(receivableOperation.businessId, businessIds));
    await database.db
      .delete(receivablePayment)
      .where(inArray(receivablePayment.businessId, businessIds));
    await database.db.delete(receivable).where(inArray(receivable.businessId, businessIds));
    await database.db.delete(customer).where(inArray(customer.businessId, businessIds));
    await database.db
      .delete(cashOperationReceipt)
      .where(inArray(cashOperationReceipt.businessId, businessIds));
    await database.db.delete(cashAccount).where(inArray(cashAccount.businessId, businessIds));
    await database.db
      .delete(catalogOperation)
      .where(inArray(catalogOperation.businessId, businessIds));
    await database.db
      .delete(inventoryMovement)
      .where(inArray(inventoryMovement.businessId, businessIds));
    await database.db.delete(catalogProduct).where(inArray(catalogProduct.businessId, businessIds));
  }
  await database.db.delete(member).where(inArray(member.userId, Object.values(userIds)));
  await database.db.delete(session).where(inArray(session.id, Object.values(sessionIds)));
  if (businessIds.length > 0) {
    await database.db
      .delete(businessSettings)
      .where(inArray(businessSettings.businessId, businessIds));
    await database.db.delete(organization).where(inArray(organization.id, businessIds));
  }
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.close();
});

describe("assistant directory", () => {
  test("finds folded names of active records in the active business only", async () => {
    const result = await directory.lookup(actor("ownerA", businessA), {
      products: ["cafe"],
      customers: ["ana"],
    });
    expect(result.context).toMatchObject({
      businessId: businessA,
      currency: "USD",
      currencyMinorUnitDigits: 2,
      timeZone: "America/El_Salvador",
    });
    expect(result.context.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.context.localTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result.products).toEqual([
      expect.objectContaining({
        name: "Café molido 1 lb",
        sellingPriceMinorUnits: "325",
        onHandMinorUnits: "12",
      }),
    ]);
    expect(result.customers).toEqual([
      {
        id: anaId,
        name: "Ana Guzmán",
        oldestOpenReceivable: {
          id: openReceivableId,
          description: "Venta al crédito",
          balanceMinorUnits: "5475",
        },
      },
    ]);
    expect(result.accounts.map((account) => account.name)).toEqual(["Caja principal"]);
  });

  test("a search term cannot act as a LIKE wildcard", async () => {
    const result = await directory.lookup(actor("ownerA", businessA), {
      products: ["%", "_"],
      customers: ["%%"],
    });
    expect(result.products).toEqual([]);
    expect(result.customers).toEqual([]);
  });

  test("a member sees only what the role can read", async () => {
    const result = await directory.lookup(actor("member", businessA), {
      products: ["cafe"],
      customers: ["ana"],
    });
    expect(result.context.permissions).toContain("assistant:use");
    expect(result.products.map((product) => product.name)).toEqual(["Café molido 1 lb"]);
    // Members read stock but not receivables.
    expect(result.products[0]?.onHandMinorUnits).toBe("12");
    expect(result.customers).toEqual([
      { id: anaId, name: "Ana Guzmán", oldestOpenReceivable: null },
    ]);
    expect(result.accounts.map((account) => account.name)).toEqual(["Caja principal"]);
  });

  test("a user without membership in the session's business is refused", async () => {
    await expect(directory.authorize(actor("outsider", businessA))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      directory.lookup(actor("ownerB", businessA), { products: ["cafe"], customers: [] }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await directory.authorize(actor("ownerB", businessB))).toEqual({
      businessId: businessB,
    });
  });
});
