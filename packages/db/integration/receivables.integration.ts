import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";

import {
  createDatabase,
  createProductRepository,
  member,
  organization,
  parseDatabaseConfig,
  session,
  user,
} from "../src/index.ts";
import { createReceivablesRepository } from "../src/receivables.ts";
import {
  customer,
  receivable,
  receivableOperation,
  receivablePayment,
} from "../src/schema/receivables.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 8 });
const product = createProductRepository(database.db);
const repository = createReceivablesRepository(database.db);
const runId = crypto.randomUUID();
const userIds = {
  admin: `receivables-admin-${runId}`,
  member: `receivables-member-${runId}`,
  ownerA: `receivables-owner-a-${runId}`,
  ownerB: `receivables-owner-b-${runId}`,
  unknown: `receivables-unknown-${runId}`,
};
const sessionIds = {
  admin: `receivables-session-admin-${runId}`,
  member: `receivables-session-member-${runId}`,
  ownerA: `receivables-session-owner-a-${runId}`,
  ownerB: `receivables-session-owner-b-${runId}`,
  unknown: `receivables-session-unknown-${runId}`,
};
const businessIds: string[] = [];
let businessA = "";
let businessB = "";

const actor = (key: keyof typeof userIds, businessId: string) => ({
  userId: userIds[key],
  sessionId: sessionIds[key],
  activeBusinessId: businessId,
});

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([key, id]) => ({
      id,
      name: `Receivables ${key}`,
      email: `receivables-${key}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    Object.entries(sessionIds).map(([key, id]) => ({
      id,
      token: `receivables-token-${key}-${runId}`,
      userId: userIds[key as keyof typeof userIds],
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })),
  );

  const createdA = await product.createBusiness(actor("ownerA", ""), {
    name: `Receivables Store A ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  const createdB = await product.createBusiness(actor("ownerB", ""), {
    name: `Receivables Store B ${runId.slice(0, 8)}`,
    currency: "USD",
    timeZone: "America/El_Salvador",
  });
  businessA = createdA.business.id;
  businessB = createdB.business.id;
  businessIds.push(businessA, businessB);

  await database.db.insert(member).values([
    {
      id: crypto.randomUUID(),
      organizationId: businessA,
      userId: userIds.admin,
      role: "admin",
    },
    {
      id: crypto.randomUUID(),
      organizationId: businessA,
      userId: userIds.member,
      role: "member",
    },
    {
      id: crypto.randomUUID(),
      organizationId: businessA,
      userId: userIds.unknown,
      role: "accountant",
    },
  ]);
  for (const key of ["admin", "member", "unknown"] as const) {
    await database.db
      .update(session)
      .set({ activeOrganizationId: businessA })
      .where(eq(session.id, sessionIds[key]));
  }
});

afterAll(async () => {
  if (businessIds.length > 0) {
    await database.db
      .delete(receivableOperation)
      .where(inArray(receivableOperation.businessId, businessIds));
    await database.db
      .delete(receivablePayment)
      .where(inArray(receivablePayment.businessId, businessIds));
    await database.db.delete(receivable).where(inArray(receivable.businessId, businessIds));
    await database.db.delete(customer).where(inArray(customer.businessId, businessIds));
  }
  await database.db.delete(member).where(inArray(member.userId, Object.values(userIds)));
  await database.db.delete(session).where(inArray(session.id, Object.values(sessionIds)));
  if (businessIds.length > 0) {
    const { businessSettings } = await import("../src/schema/business.ts");
    await database.db
      .delete(businessSettings)
      .where(inArray(businessSettings.businessId, businessIds));
    await database.db.delete(organization).where(inArray(organization.id, businessIds));
  }
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.close();
});

describe("customers and receivables repository on PostgreSQL 18", () => {
  test("keeps contacts tenant-private and applies exact owner/admin/member permissions", async () => {
    const key = crypto.randomUUID();
    const command = {
      idempotencyKey: key,
      name: "Private Customer",
      phone: "+503 7000 0000",
      email: `private-${runId}@example.test`,
      notes: "Never include this contact in logs",
    };
    const created = await repository.createCustomer(actor("ownerA", businessA), command);
    const replay = await repository.createCustomer(actor("ownerA", businessA), command);
    expect(replay).toEqual({ ...created, replayed: true });
    await expect(
      repository.createCustomer(actor("ownerA", businessA), { ...command, name: "Changed" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    await expect(
      repository.getCustomer(actor("ownerB", businessB), created.customer.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      repository.listCustomers(actor("member", businessA), { limit: 25, status: "active" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      repository.listCustomers(actor("unknown", businessA), { limit: 25, status: "active" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const adminView = await repository.getCustomer(actor("admin", businessA), created.customer.id);
    expect(adminView.customer.email).toBe(command.email);
    expect(adminView.customer.phone).toBe(command.phone);
  });

  test("rejects archived-customer writes while preserving correction history", async () => {
    const created = await repository.createCustomer(actor("admin", businessA), {
      idempotencyKey: crypto.randomUUID(),
      name: "Archived Customer",
    });
    const archiveKey = crypto.randomUUID();
    const archived = await repository.archiveCustomer(
      actor("admin", businessA),
      created.customer.id,
      {
        idempotencyKey: archiveKey,
      },
    );
    const replay = await repository.archiveCustomer(
      actor("admin", businessA),
      created.customer.id,
      {
        idempotencyKey: archiveKey,
      },
    );
    expect(archived.customer.status).toBe("archived");
    expect(replay).toEqual({ ...archived, replayed: true });
    await expect(
      repository.updateCustomer(actor("admin", businessA), created.customer.id, {
        idempotencyKey: crypto.randomUUID(),
        name: "Should fail",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      repository.postReceivable(actor("admin", businessA), {
        idempotencyKey: crypto.randomUUID(),
        customerId: created.customer.id,
        originalMinorUnits: "1000",
        description: "Should fail",
        postedDate: "2026-08-01",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("serializes payments, replays exactly, derives overdue locally, and reverses once", async () => {
    const createdCustomer = await repository.createCustomer(actor("ownerA", businessA), {
      idempotencyKey: crypto.randomUUID(),
      name: "Concurrent Customer",
    });
    const postKey = crypto.randomUUID();
    const postCommand = {
      idempotencyKey: postKey,
      customerId: createdCustomer.customer.id,
      originalMinorUnits: "1000",
      description: "Old open charge",
      postedDate: "2000-01-01",
      dueDate: "2000-01-02",
    };
    const posted = await repository.postReceivable(actor("ownerA", businessA), postCommand);
    const postReplay = await repository.postReceivable(actor("ownerA", businessA), postCommand);
    expect(postReplay).toEqual({ ...posted, replayed: true });
    await expect(
      repository.postReceivable(actor("ownerA", businessA), {
        ...postCommand,
        originalMinorUnits: "1001",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(posted.receivable.state).toBe("overdue");

    const cashAccountId = crypto.randomUUID();
    const paymentCommands = [crypto.randomUUID(), crypto.randomUUID()].map((idempotencyKey) => ({
      idempotencyKey,
      amountMinorUnits: "700",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "10:00",
      cashAccountId,
    }));
    const concurrent = await Promise.allSettled(
      paymentCommands.map((command) =>
        repository.applyPayment(actor("ownerA", businessA), posted.receivable.id, command),
      ),
    );
    const fulfilled = concurrent.filter(
      (
        result,
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof repository.applyPayment>>> =>
        result.status === "fulfilled",
    );
    const rejected = concurrent.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "CONFLICT" });
    const successfulPayment = fulfilled[0];
    if (!successfulPayment) throw new Error("Concurrent payment test returned no result");
    expect(successfulPayment.value.receivable.outstandingMinorUnits).toBe("300");

    const operation = await database.db
      .select({ idempotencyKey: receivableOperation.idempotencyKey })
      .from(receivableOperation)
      .where(eq(receivableOperation.paymentId, successfulPayment.value.payment.id));
    const replayCommand = paymentCommands.find(
      ({ idempotencyKey }) => idempotencyKey === operation[0]?.idempotencyKey,
    );
    if (!replayCommand) throw new Error("Successful payment operation receipt was not found");
    const paymentReplay = await repository.applyPayment(
      actor("ownerA", businessA),
      posted.receivable.id,
      replayCommand,
    );
    expect(paymentReplay.payment.id).toBe(successfulPayment.value.payment.id);
    expect(paymentReplay.replayed).toBe(true);

    const reversalKey = crypto.randomUUID();
    const reversalCommand = {
      idempotencyKey: reversalKey,
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "10:30",
      reference: "Correction",
    };
    const reversed = await repository.reversePayment(
      actor("ownerA", businessA),
      successfulPayment.value.payment.id,
      reversalCommand,
    );
    const reversalReplay = await repository.reversePayment(
      actor("ownerA", businessA),
      successfulPayment.value.payment.id,
      reversalCommand,
    );
    expect(reversalReplay).toEqual({ ...reversed, replayed: true });
    expect(reversed.receivable.outstandingMinorUnits).toBe("1000");
    await expect(
      repository.reversePayment(actor("ownerA", businessA), successfulPayment.value.payment.id, {
        ...reversalCommand,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const summary = await repository.getSummary(actor("ownerA", businessA));
    expect(summary.outstandingMinorUnits).toBe("1000");
    expect(summary.overdueMinorUnits).toBe("1000");
    expect(summary.businessLocalDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("requires reversal before void and denies stale sessions", async () => {
    const createdCustomer = await repository.createCustomer(actor("ownerA", businessA), {
      idempotencyKey: crypto.randomUUID(),
      name: "Void Customer",
    });
    const posted = await repository.postReceivable(actor("ownerA", businessA), {
      idempotencyKey: crypto.randomUUID(),
      customerId: createdCustomer.customer.id,
      originalMinorUnits: "500",
      description: "Void flow",
      postedDate: "2026-08-22",
    });
    const payment = await repository.applyPayment(
      actor("ownerA", businessA),
      posted.receivable.id,
      {
        idempotencyKey: crypto.randomUUID(),
        amountMinorUnits: "500",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "11:00",
        cashAccountId: crypto.randomUUID(),
      },
    );
    await expect(
      repository.voidReceivable(actor("ownerA", businessA), posted.receivable.id, {
        idempotencyKey: crypto.randomUUID(),
        reason: "Duplicate charge",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await repository.reversePayment(actor("ownerA", businessA), payment.payment.id, {
      idempotencyKey: crypto.randomUUID(),
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "11:05",
    });
    const voidKey = crypto.randomUUID();
    const command = { idempotencyKey: voidKey, reason: "Duplicate charge" };
    const voided = await repository.voidReceivable(
      actor("ownerA", businessA),
      posted.receivable.id,
      command,
    );
    const replay = await repository.voidReceivable(
      actor("ownerA", businessA),
      posted.receivable.id,
      command,
    );
    expect(voided.receivable.state).toBe("voided");
    expect(replay).toEqual({ ...voided, replayed: true });

    await database.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(session.id, sessionIds.ownerA));
    await expect(repository.getSummary(actor("ownerA", businessA))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
