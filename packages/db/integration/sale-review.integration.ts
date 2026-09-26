import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import {
  businessSettings,
  createDatabase,
  createProductRepository,
  member,
  organization,
  type ProductActor,
  parseDatabaseConfig,
  sale,
  saleOperation,
  saleReview,
  session,
  user,
} from "../src/index.ts";
import { postSale } from "../src/sales-posting.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 6 });
const repository = createProductRepository(database.db);
const run = crypto.randomUUID();
const actors: ProductActor[] = [0, 1, 2].map((n) => ({
  userId: `review-user-${n}-${run}`,
  sessionId: `review-session-${n}-${run}`,
  activeBusinessId: null,
}));
const [owner, outsider, coworker] = actors as [ProductActor, ProductActor, ProductActor];
const businesses: string[] = [];
const command = () => ({
  idempotencyKey: crypto.randomUUID(),
  grossMinorUnits: "1250",
  occurredLocalDate: "2026-09-26",
  occurredLocalTime: "14:30",
  description: "Synthetic review fixture",
});
function ownerBusinessId(): string {
  if (!owner.activeBusinessId) throw new Error("Missing synthetic business");
  return owner.activeBusinessId;
}
const ownSales = () =>
  database.db.select().from(sale).where(eq(sale.businessId, ownerBusinessId()));

beforeAll(async () => {
  for (const actor of actors) {
    await database.db
      .insert(user)
      .values({ id: actor.userId, name: "Review fixture", email: `${actor.userId}@example.test` });
    await database.db.insert(session).values({
      id: actor.sessionId,
      userId: actor.userId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 600_000),
    });
  }
  for (const actor of [owner, outsider]) {
    const { business } = await repository.createBusiness(actor, {
      name: "Review fixture",
      currency: "USD",
      timeZone: "America/El_Salvador",
    });
    actor.activeBusinessId = business.id;
    businesses.push(business.id);
  }
  coworker.activeBusinessId = owner.activeBusinessId;
  await database.db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: ownerBusinessId(),
    userId: coworker.userId,
    role: "member",
  });
  await database.db
    .update(session)
    .set({ activeOrganizationId: ownerBusinessId() })
    .where(eq(session.id, coworker.sessionId));
});
beforeEach(async () => {
  await database.db.delete(saleReview).where(inArray(saleReview.businessId, businesses));
});
afterAll(async () => {
  if (businesses.length) {
    await database.db.delete(saleReview).where(inArray(saleReview.businessId, businesses));
    await database.db.delete(saleOperation).where(inArray(saleOperation.businessId, businesses));
    await database.db.delete(sale).where(inArray(sale.businessId, businesses));
    await database.db
      .delete(businessSettings)
      .where(inArray(businessSettings.businessId, businesses));
    await database.db.delete(member).where(inArray(member.organizationId, businesses));
    await database.db.delete(organization).where(inArray(organization.id, businesses));
  }
  await database.db.delete(session).where(
    inArray(
      session.id,
      actors.map((actor) => actor.sessionId),
    ),
  );
  await database.db.delete(user).where(
    inArray(
      user.id,
      actors.map((actor) => actor.userId),
    ),
  );
  await database.close();
});

describe("server-owned sale review recovery", () => {
  test("canonicalizes UUID casing without changing the confirmation identity", async () => {
    const input = command();
    const prepared = await repository.prepareSaleReview(owner, {
      ...input,
      idempotencyKey: input.idempotencyKey.toUpperCase(),
    });
    expect(prepared.id).toBe(input.idempotencyKey);
    expect(prepared.command.idempotencyKey).toBe(input.idempotencyKey);
  });
  test("survives a new repository instance without posting and replays only matching preparation", async () => {
    const before = (await ownSales()).length;
    const input = command();
    const prepared = await repository.prepareSaleReview(owner, input);
    expect(await createProductRepository(database.db).getSaleReview(owner)).toEqual(prepared);
    expect(await repository.prepareSaleReview(owner, input)).toEqual(prepared);
    expect((await ownSales()).length).toBe(before);
    await expect(
      repository.prepareSaleReview(owner, { ...input, grossMinorUnits: "1300" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(repository.prepareSaleReview(owner, command())).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
  test("double confirmation commits exactly once and the lost result remains recoverable", async () => {
    const before = (await ownSales()).length;
    const review = await repository.prepareSaleReview(owner, command());
    const results = await Promise.all([
      repository.confirmSaleReview(owner, review.id),
      repository.confirmSaleReview(owner, review.id),
    ]);
    expect(results[0].sale.id).toBe(results[1].sale.id);
    expect(results.filter((result) => !result.replayed)).toHaveLength(1);
    expect((await ownSales()).length).toBe(before + 1);
    expect((await repository.getSaleReview(owner))?.saleId).toBe(results[0].sale.id);
  });
  test("a cancelled review cannot be resurrected or posted through the direct command", async () => {
    const input = command();
    const review = await repository.prepareSaleReview(owner, input);
    expect(await repository.dismissSaleReview(owner, review.id, null)).toEqual({ saleId: null });
    await expect(repository.prepareSaleReview(owner, input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(repository.confirmSaleReview(owner, review.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repository.createSale(owner, input)).rejects.toMatchObject({ code: "CONFLICT" });
    const next = await repository.prepareSaleReview(owner, command());
    await repository.dismissSaleReview(owner, review.id, null);
    expect((await repository.getSaleReview(owner))?.id).toBe(next.id);
  });
  test("a stale cancel does not hide a saved sale even when its response is lost", async () => {
    const review = await repository.prepareSaleReview(owner, command());
    const result = await repository.confirmSaleReview(owner, review.id);
    expect(await repository.dismissSaleReview(owner, review.id, null)).toEqual({
      saleId: result.sale.id,
    });
    expect((await repository.getSaleReview(owner))?.saleId).toBe(result.sale.id);
    await expect(
      repository.dismissSaleReview(owner, review.id, crypto.randomUUID()),
    ).resolves.toEqual({ saleId: result.sale.id });
    await repository.dismissSaleReview(owner, review.id, result.sale.id);
    expect(await repository.getSaleReview(owner)).toBeNull();
    const [closed] = await database.db
      .select()
      .from(saleReview)
      .where(eq(saleReview.id, review.id));
    expect(closed?.command).toBeNull();
    expect(closed?.saleId).toBe(result.sale.id);
    expect(await repository.dismissSaleReview(owner, review.id, result.sale.id)).toEqual({
      saleId: result.sale.id,
    });
  });
  test("concurrent cancel and confirm have one truthful serialized outcome", async () => {
    const review = await repository.prepareSaleReview(owner, command());
    const [confirmation, dismissal] = await Promise.allSettled([
      repository.confirmSaleReview(owner, review.id),
      repository.dismissSaleReview(owner, review.id, null),
    ]);
    expect(dismissal.status).toBe("fulfilled");
    if (dismissal.status !== "fulfilled") throw new Error("Dismissal failed");
    if (confirmation.status === "fulfilled") {
      expect(dismissal.value.saleId).toBe(confirmation.value.sale.id);
      expect((await repository.getSaleReview(owner))?.saleId).toBe(confirmation.value.sale.id);
    } else {
      expect(dismissal.value.saleId).toBeNull();
      expect(await repository.getSaleReview(owner)).toBeNull();
    }
  });
  test("isolates business and actor even when both actors share the same business", async () => {
    const review = await repository.prepareSaleReview(owner, command());
    for (const actor of [outsider, coworker]) {
      expect(await repository.getSaleReview(actor)).toBeNull();
      await expect(repository.confirmSaleReview(actor, review.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(repository.dismissSaleReview(actor, review.id, null)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(repository.prepareSaleReview(actor, review.command)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    }
    const separate = await repository.prepareSaleReview(coworker, command());
    expect((await repository.getSaleReview(owner))?.id).toBe(review.id);
    expect((await repository.getSaleReview(coworker))?.id).toBe(separate.id);
  });
  test("revalidates expiration on reads and every review action", async () => {
    const review = await repository.prepareSaleReview(owner, command());
    await database.db
      .update(session)
      .set({ expiresAt: new Date(0) })
      .where(eq(session.id, owner.sessionId));
    try {
      for (const action of [
        () => repository.getSaleReview(owner),
        () => repository.prepareSaleReview(owner, review.command),
        () => repository.confirmSaleReview(owner, review.id),
        () => repository.dismissSaleReview(owner, review.id, null),
      ]) {
        await expect(action()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      }
    } finally {
      await database.db
        .update(session)
        .set({ expiresAt: new Date(Date.now() + 600_000) })
        .where(eq(session.id, owner.sessionId));
    }
  });
  test("refuses changed time-zone meaning while keeping the reviewed snapshot", async () => {
    const review = await repository.prepareSaleReview(owner, command());
    await database.db
      .update(businessSettings)
      .set({ timeZone: "UTC" })
      .where(eq(businessSettings.businessId, ownerBusinessId()));
    try {
      await expect(repository.confirmSaleReview(owner, review.id)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect((await repository.getSaleReview(owner))?.timeZone).toBe("America/El_Salvador");
      expect((await repository.getSaleReview(owner))?.saleId).toBeNull();
    } finally {
      await database.db
        .update(businessSettings)
        .set({ timeZone: "America/El_Salvador" })
        .where(eq(businessSettings.businessId, ownerBusinessId()));
    }
  });
  test("rolls back the ledger and review result together", async () => {
    const review = await repository.prepareSaleReview(owner, command());
    const before = (await ownSales()).length;
    await expect(
      database.db.transaction(async (tx) => {
        await postSale(tx, owner, review.command);
        throw new Error("Synthetic failure after posting");
      }),
    ).rejects.toThrow("Synthetic failure");
    expect((await ownSales()).length).toBe(before);
    expect((await repository.getSaleReview(owner))?.saleId).toBeNull();
    expect((await repository.confirmSaleReview(owner, review.id)).replayed).toBe(false);
  });
  test("rejects malformed preparation and direct mutation of a reviewed command", async () => {
    await expect(
      repository.prepareSaleReview(owner, { ...command(), occurredLocalDate: "2026-02-30" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const review = await repository.prepareSaleReview(owner, command());
    await expect(
      repository.createSale(owner, { ...review.command, grossMinorUnits: "1" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const result = await repository.createSale(owner, review.command);
    expect((await repository.getSaleReview(owner))?.saleId).toBe(result.sale.id);
  });
});
