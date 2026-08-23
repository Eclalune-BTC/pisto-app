import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { fingerprint } from "../src/catalog/codec.ts";
import { createCatalogRepository } from "../src/catalog.ts";
import {
  businessSettings,
  createDatabase,
  member,
  organization,
  ProductError,
  parseDatabaseConfig,
  session,
  user,
} from "../src/index.ts";
import {
  catalogCategory,
  catalogOperation,
  catalogProduct,
  inventoryMovement,
} from "../src/schema/catalog.ts";

const database = createDatabase({
  ...parseDatabaseConfig(process.env),
  maxConnections: 8,
});
const repository = createCatalogRepository(database.db);
const runId = crypto.randomUUID();
const userIds = {
  admin: `catalog-admin-${runId}`,
  expired: `catalog-expired-${runId}`,
  member: `catalog-member-${runId}`,
  otherOwner: `catalog-other-owner-${runId}`,
  owner: `catalog-owner-${runId}`,
  unsupported: `catalog-unsupported-${runId}`,
};
const sessionIds = Object.fromEntries(
  Object.entries(userIds).map(([key, value]) => [key, `${value}-session`]),
) as Record<keyof typeof userIds, string>;
const firstBusinessId = `catalog-business-a-${runId}`;
const secondBusinessId = `catalog-business-b-${runId}`;

function actor(key: keyof typeof userIds, businessId = firstBusinessId) {
  return {
    userId: userIds[key],
    sessionId: sessionIds[key],
    activeBusinessId: businessId,
  };
}

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([key, id]) => ({
      id,
      name: `Catalog ${key}`,
      email: `${key}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(organization).values([
    { id: firstBusinessId, name: "Catalog JPY Store", slug: `catalog-a-${runId}` },
    { id: secondBusinessId, name: "Catalog USD Store", slug: `catalog-b-${runId}` },
  ]);
  await database.db.insert(businessSettings).values([
    {
      businessId: firstBusinessId,
      currency: "JPY",
      currencyMinorUnitDigits: 0,
      timeZone: "Asia/Tokyo",
    },
    {
      businessId: secondBusinessId,
      currency: "USD",
      currencyMinorUnitDigits: 2,
      timeZone: "America/El_Salvador",
    },
  ]);
  await database.db.insert(member).values([
    {
      id: crypto.randomUUID(),
      organizationId: firstBusinessId,
      userId: userIds.owner,
      role: "owner",
    },
    {
      id: crypto.randomUUID(),
      organizationId: firstBusinessId,
      userId: userIds.admin,
      role: "admin",
    },
    {
      id: crypto.randomUUID(),
      organizationId: firstBusinessId,
      userId: userIds.member,
      role: "member",
    },
    {
      id: crypto.randomUUID(),
      organizationId: firstBusinessId,
      userId: userIds.expired,
      role: "owner",
    },
    {
      id: crypto.randomUUID(),
      organizationId: firstBusinessId,
      userId: userIds.unsupported,
      role: "auditor",
    },
    {
      id: crypto.randomUUID(),
      organizationId: secondBusinessId,
      userId: userIds.otherOwner,
      role: "owner",
    },
  ]);
  await database.db.insert(session).values(
    Object.entries(userIds).map(([key, userId]) => ({
      id: sessionIds[key as keyof typeof userIds],
      token: `catalog-${key}-${runId}`,
      userId,
      activeOrganizationId: key === "otherOwner" ? secondBusinessId : firstBusinessId,
      expiresAt: key === "expired" ? new Date(Date.now() - 1_000) : new Date(Date.now() + 120_000),
    })),
  );
});

afterAll(async () => {
  await database.db
    .delete(catalogOperation)
    .where(inArray(catalogOperation.businessId, [firstBusinessId, secondBusinessId]));
  await database.db
    .delete(inventoryMovement)
    .where(inArray(inventoryMovement.businessId, [firstBusinessId, secondBusinessId]));
  await database.db
    .delete(catalogProduct)
    .where(inArray(catalogProduct.businessId, [firstBusinessId, secondBusinessId]));
  await database.db
    .delete(catalogCategory)
    .where(inArray(catalogCategory.businessId, [firstBusinessId, secondBusinessId]));
  await database.db
    .delete(businessSettings)
    .where(inArray(businessSettings.businessId, [firstBusinessId, secondBusinessId]));
  await database.db
    .delete(member)
    .where(inArray(member.organizationId, [firstBusinessId, secondBusinessId]));
  await database.db.delete(session).where(inArray(session.id, Object.values(sessionIds)));
  await database.db
    .delete(organization)
    .where(inArray(organization.id, [firstBusinessId, secondBusinessId]));
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.close();
});

describe("catalog and inventory repository on PostgreSQL 18", () => {
  test("snapshots the user-selected business currency and isolates unique keys by tenant", async () => {
    const categoryCommand = {
      idempotencyKey: crypto.randomUUID(),
      name: "Beverages",
    };
    const category = await repository.createCategory(actor("owner"), categoryCommand);
    expect(category.category.name).toBe("Beverages");
    expect(category.replayed).toBe(false);

    const replay = await repository.createCategory(actor("owner"), categoryCommand);
    expect(replay).toEqual({ ...category, replayed: true });
    await expect(
      repository.createCategory(actor("owner"), { ...categoryCommand, name: "Other" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      repository.createCategory(actor("admin"), {
        idempotencyKey: crypto.randomUUID(),
        name: "beverages",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const productCommand = {
      idempotencyKey: crypto.randomUUID(),
      categoryId: category.category.id,
      name: "Iced coffee",
      sku: "COF-01",
      sellingPriceMinorUnits: "550",
      unitKind: "unit" as const,
      quantityPrecision: 0,
      tracked: true,
      lowStockThresholdMinorUnits: "2",
    };
    const first = await repository.createProduct(actor("admin"), productCommand);
    expect(first.product.sellingPriceCurrency).toBe("JPY");
    expect(first.product.sellingPriceCurrencyMinorUnitDigits).toBe(0);

    const other = await repository.createProduct(actor("otherOwner", secondBusinessId), {
      ...productCommand,
      idempotencyKey: crypto.randomUUID(),
      categoryId: null,
    });
    expect(other.product.sku).toBe("COF-01");
    expect(other.product.sellingPriceCurrency).toBe("USD");
    expect(other.product.sellingPriceCurrencyMinorUnitDigits).toBe(2);
    await expect(
      repository.getProduct(actor("otherOwner", secondBusinessId), first.product.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      repository.createProduct(actor("owner"), {
        ...productCommand,
        idempotencyKey: crypto.randomUUID(),
        name: "Duplicate SKU",
        sku: "cof-01",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("lets members read but denies catalog and inventory writes", async () => {
    const memberList = await repository.listProducts(actor("member"), {
      limit: 25,
      status: "active",
    });
    expect(memberList.items.length).toBeGreaterThan(0);
    await expect(
      repository.createCategory(actor("member"), {
        idempotencyKey: crypto.randomUUID(),
        name: "Denied",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      repository.listProducts(actor("unsupported"), { limit: 25, status: "active" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      repository.listProducts(actor("expired"), { limit: 25, status: "active" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("refuses to replay a receipt recorded for a different action", async () => {
    // The replay guard compares the stored action as well as the fingerprint. A
    // receipt written by another command must never be returned as this one, even
    // when its recorded fingerprint matches the confirmed command.
    const product = await repository.createProduct(actor("owner"), {
      idempotencyKey: crypto.randomUUID(),
      name: "Action guard probe",
      sku: "GUARD-01",
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: false,
    });
    const categoryCommand = {
      idempotencyKey: crypto.randomUUID(),
      name: "Action guard category",
    };
    await database.db.insert(catalogOperation).values({
      action: "product.archived",
      actorUserId: userIds.owner,
      businessId: firstBusinessId,
      commandFingerprint: await fingerprint("category.created", { name: categoryCommand.name }),
      idempotencyKey: categoryCommand.idempotencyKey,
      productId: product.product.id,
      resultSnapshot: { product: product.product },
    });

    await expect(repository.createCategory(actor("owner"), categoryCommand)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  test("serializes outbound stock, preserves exact precision, and reverses once", async () => {
    const product = await repository.createProduct(actor("owner"), {
      idempotencyKey: crypto.randomUUID(),
      name: "Measured flour",
      sku: "FLOUR-001",
      unitKind: "kilogram",
      quantityPrecision: 3,
      tracked: true,
      lowStockThresholdMinorUnits: "3000",
    });
    const receiveCommand = {
      idempotencyKey: crypto.randomUUID(),
      action: "receive" as const,
      quantityMinorUnits: "10000",
      reason: "Opening count",
      occurredLocalDate: "2026-08-23",
      occurredLocalTime: "09:00",
    };
    const received = await repository.recordMovement(
      actor("owner"),
      product.product.id,
      receiveCommand,
    );
    expect(received.stock.onHandMinorUnits).toBe("10000");
    expect(received.movement.quantityPrecision).toBe(3);
    expect(
      (await repository.recordMovement(actor("owner"), product.product.id, receiveCommand))
        .replayed,
    ).toBe(true);

    const concurrent = await Promise.allSettled([
      repository.recordMovement(actor("owner"), product.product.id, {
        ...receiveCommand,
        idempotencyKey: crypto.randomUUID(),
        action: "adjust_out",
        quantityMinorUnits: "7000",
        reason: "First concurrent outbound",
      }),
      repository.recordMovement(actor("admin"), product.product.id, {
        ...receiveCommand,
        idempotencyKey: crypto.randomUUID(),
        action: "adjust_out",
        quantityMinorUnits: "7000",
        reason: "Second concurrent outbound",
      }),
    ]);
    const fulfilled = concurrent.filter(
      (
        result,
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.recordMovement>>> =>
        result.status === "fulfilled",
    );
    const rejected = concurrent.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(ProductError);
    expect(fulfilled[0]?.value.stock.onHandMinorUnits).toBe("3000");

    const outbound = fulfilled[0]?.value.movement;
    if (!outbound) throw new Error("Expected one outbound movement");
    const reversalCommand = {
      idempotencyKey: crypto.randomUUID(),
      reason: "Outbound was entered twice",
      occurredLocalDate: "2026-08-23",
      occurredLocalTime: "09:05",
    };
    const reversal = await repository.reverseMovement(actor("owner"), outbound.id, reversalCommand);
    expect(reversal.stock.onHandMinorUnits).toBe("10000");
    expect(reversal.movement.deltaMinorUnits).toBe("7000");
    expect(
      (await repository.reverseMovement(actor("owner"), outbound.id, reversalCommand)).replayed,
    ).toBe(true);
    await expect(
      repository.reverseMovement(actor("owner"), outbound.id, {
        ...reversalCommand,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      repository.updateProduct(actor("owner"), product.product.id, {
        idempotencyKey: crypto.randomUUID(),
        quantityPrecision: 2,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      repository.recordMovement(actor("member"), product.product.id, {
        ...receiveCommand,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("rejects a reversal that would make stock negative and exposes low-stock truth", async () => {
    const product = await repository.createProduct(actor("owner"), {
      idempotencyKey: crypto.randomUUID(),
      name: "Reversal invariant product",
      sku: "REVERSE-001",
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: true,
      lowStockThresholdMinorUnits: "1",
    });
    const received = await repository.recordMovement(actor("owner"), product.product.id, {
      idempotencyKey: crypto.randomUUID(),
      action: "receive",
      quantityMinorUnits: "5",
      reason: "Opening count",
      occurredLocalDate: "2026-08-23",
      occurredLocalTime: "10:00",
    });
    await repository.recordMovement(actor("owner"), product.product.id, {
      idempotencyKey: crypto.randomUUID(),
      action: "adjust_out",
      quantityMinorUnits: "5",
      reason: "Used stock",
      occurredLocalDate: "2026-08-23",
      occurredLocalTime: "10:01",
    });
    await expect(
      repository.reverseMovement(actor("owner"), received.movement.id, {
        idempotencyKey: crypto.randomUUID(),
        reason: "Invalid reversal attempt",
        occurredLocalDate: "2026-08-23",
        occurredLocalTime: "10:02",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const lowStock = await repository.listStock(actor("member"), {
      limit: 50,
      lowStockOnly: true,
    });
    expect(lowStock.items.some((item) => item.product.id === product.product.id)).toBe(true);
    const history = await repository.listMovements(actor("member"), product.product.id, {
      limit: 25,
    });
    expect(history.items).toHaveLength(2);
  });

  test("archives references without deleting history or permitting later movements", async () => {
    const category = await repository.createCategory(actor("owner"), {
      idempotencyKey: crypto.randomUUID(),
      name: "Archive category",
    });
    const product = await repository.createProduct(actor("owner"), {
      idempotencyKey: crypto.randomUUID(),
      categoryId: category.category.id,
      name: "Archive product",
      sku: "ARCHIVE-001",
      unitKind: "unit",
      quantityPrecision: 0,
      tracked: true,
    });
    const archived = await repository.archiveProduct(actor("admin"), product.product.id, {
      idempotencyKey: crypto.randomUUID(),
    });
    expect(archived.product.status).toBe("archived");
    await expect(
      repository.recordMovement(actor("owner"), product.product.id, {
        idempotencyKey: crypto.randomUUID(),
        action: "receive",
        quantityMinorUnits: "1",
        reason: "Archived mutation",
        occurredLocalDate: "2026-08-23",
        occurredLocalTime: "11:00",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await repository.getProduct(actor("member"), product.product.id)).product.status).toBe(
      "archived",
    );
    expect(
      (
        await database.db
          .select({ id: catalogProduct.id })
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, firstBusinessId),
              eq(catalogProduct.id, product.product.id),
            ),
          )
      ).length,
    ).toBe(1);
    expect(
      (
        await repository.archiveCategory(actor("owner"), category.category.id, {
          idempotencyKey: crypto.randomUUID(),
        })
      ).category.status,
    ).toBe("archived");
  });
});
