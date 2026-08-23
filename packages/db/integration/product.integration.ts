import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  businessSettings,
  createDatabase,
  createProductRepository,
  member,
  organization,
  type ProductActor,
  ProductError,
  parseDatabaseConfig,
  sale,
  saleCorrection,
  saleOperation,
  session,
  user,
} from "../src/index.ts";

const database = createDatabase({
  ...parseDatabaseConfig(process.env),
  maxConnections: 4,
});
const repository = createProductRepository(database.db);
const runId = crypto.randomUUID();
const userIds = [
  `integration-owner-a-${runId}`,
  `integration-owner-b-${runId}`,
  `integration-rollback-${runId}`,
  `integration-incomplete-${runId}`,
  `integration-admin-${runId}`,
  `integration-member-${runId}`,
  `integration-unsupported-role-${runId}`,
  `integration-list-owner-${runId}`,
  `integration-list-other-${runId}`,
  `integration-list-auditor-${runId}`,
];
const sessionIds = [
  `integration-session-a-${runId}`,
  `integration-session-b-${runId}`,
  `integration-session-incomplete-${runId}`,
  `integration-session-admin-${runId}`,
  `integration-session-member-${runId}`,
  `integration-session-unsupported-role-${runId}`,
  `integration-session-list-owner-${runId}`,
  `integration-session-list-other-${runId}`,
  `integration-session-list-auditor-${runId}`,
  `integration-session-list-expired-${runId}`,
];
const businessIds: string[] = [];

beforeAll(async () => {
  await database.db.insert(user).values([
    {
      id: userIds[0] as string,
      name: "Integration Owner A",
      email: `owner-a-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[1] as string,
      name: "Integration Owner B",
      email: `owner-b-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[2] as string,
      name: "Integration Rollback Owner",
      email: `rollback-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[3] as string,
      name: "Integration Incomplete Owner",
      email: `incomplete-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[4] as string,
      name: "Integration Admin",
      email: `admin-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[5] as string,
      name: "Integration Member",
      email: `member-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[6] as string,
      name: "Integration Unsupported Role",
      email: `unsupported-role-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[7] as string,
      name: "Integration List Owner",
      email: `list-owner-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[8] as string,
      name: "Integration List Other Owner",
      email: `list-other-${runId}@example.test`,
      emailVerified: true,
    },
    {
      id: userIds[9] as string,
      name: "Integration List Auditor",
      email: `list-auditor-${runId}@example.test`,
      emailVerified: true,
    },
  ]);
  await database.db.insert(session).values([
    {
      id: sessionIds[0] as string,
      token: `integration-token-a-${runId}`,
      userId: userIds[0] as string,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      id: sessionIds[1] as string,
      token: `integration-token-b-${runId}`,
      userId: userIds[1] as string,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      id: sessionIds[2] as string,
      token: `integration-token-incomplete-${runId}`,
      userId: userIds[3] as string,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      id: sessionIds[3] as string,
      token: `integration-token-admin-${runId}`,
      userId: userIds[4] as string,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      id: sessionIds[4] as string,
      token: `integration-token-member-${runId}`,
      userId: userIds[5] as string,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      id: sessionIds[5] as string,
      token: `integration-token-unsupported-role-${runId}`,
      userId: userIds[6] as string,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      id: sessionIds[6] as string,
      token: `integration-token-list-owner-${runId}`,
      userId: userIds[7] as string,
      expiresAt: new Date(Date.now() + 600_000),
    },
    {
      id: sessionIds[7] as string,
      token: `integration-token-list-other-${runId}`,
      userId: userIds[8] as string,
      expiresAt: new Date(Date.now() + 600_000),
    },
    {
      id: sessionIds[8] as string,
      token: `integration-token-list-auditor-${runId}`,
      userId: userIds[9] as string,
      expiresAt: new Date(Date.now() + 600_000),
    },
    {
      id: sessionIds[9] as string,
      token: `integration-token-list-expired-${runId}`,
      userId: userIds[7] as string,
      expiresAt: new Date(Date.now() - 1_000),
    },
  ]);
});

afterAll(async () => {
  if (businessIds.length > 0) {
    await database.db.delete(saleCorrection).where(inArray(saleCorrection.businessId, businessIds));
    await database.db.delete(saleOperation).where(inArray(saleOperation.businessId, businessIds));
    await database.db.delete(sale).where(inArray(sale.businessId, businessIds));
    await database.db
      .delete(businessSettings)
      .where(inArray(businessSettings.businessId, businessIds));
    await database.db.delete(member).where(inArray(member.organizationId, businessIds));
  }
  await database.db.delete(session).where(inArray(session.id, sessionIds));
  if (businessIds.length > 0) {
    await database.db.delete(organization).where(inArray(organization.id, businessIds));
  }
  await database.db.delete(user).where(inArray(user.id, userIds));
  await database.close();
});

describe("product repository on PostgreSQL 18", () => {
  test("rolls back onboarding when its authenticated session disappears", async () => {
    await expect(
      repository.createBusiness(
        {
          userId: userIds[2] as string,
          sessionId: `missing-session-${runId}`,
          activeBusinessId: null,
        },
        {
          name: `Rollback Store ${runId.slice(0, 8)}`,
          currency: "USD",
          timeZone: "America/El_Salvador",
        },
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const rows = await database.db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, userIds[2] as string));
    expect(rows).toHaveLength(0);
  });

  test("adopts a sole-owner organization instead of creating a second one", async () => {
    const incompleteBusinessId = `integration-incomplete-business-${runId}`;
    businessIds.push(incompleteBusinessId);
    await database.db.insert(organization).values({
      id: incompleteBusinessId,
      name: `Incomplete Store ${runId.slice(0, 8)}`,
      slug: `incomplete-${runId}`,
    });
    await database.db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: incompleteBusinessId,
      userId: userIds[3] as string,
      role: "owner",
    });

    const adopted = await repository.createBusiness(
      {
        userId: userIds[3] as string,
        sessionId: sessionIds[2] as string,
        activeBusinessId: null,
      },
      {
        name: `Adopted Store ${runId.slice(0, 8)}`,
        currency: "USD",
        timeZone: "America/El_Salvador",
      },
    );
    expect(adopted.business.id).toBe(incompleteBusinessId);
    expect(adopted.business.name).toStartWith("Adopted Store");
    expect(adopted.business.currencyMinorUnitDigits).toBe(2);

    const memberships = await database.db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.userId, userIds[3] as string));
    expect(memberships).toHaveLength(1);

    await database.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(session.id, sessionIds[2] as string));
    await expect(
      repository.createSale(
        {
          userId: userIds[3] as string,
          sessionId: sessionIds[2] as string,
          activeBusinessId: incompleteBusinessId,
        },
        {
          idempotencyKey: crypto.randomUUID(),
          grossMinorUnits: "100",
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "12:00",
        },
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("creates a tenant, commits a sale once, and summarizes the previous local month", async () => {
    const firstActor = {
      userId: userIds[0] as string,
      sessionId: sessionIds[0] as string,
      activeBusinessId: null,
    };
    const created = await repository.createBusiness(firstActor, {
      name: `Integration Store ${runId.slice(0, 8)}`,
      currency: "USD",
      timeZone: "America/El_Salvador",
    });
    businessIds.push(created.business.id);
    expect(created.replayed).toBe(false);
    expect(created.business.access).toEqual({
      role: "owner",
      permissions: [
        "business:configure",
        "business:read",
        "sales:create",
        "sales:read",
        "sales:summary:read",
        "sales:correct",
        "catalog:read",
        "catalog:manage",
        "inventory:read",
        "inventory:manage",
        "expenses:read",
        "expenses:manage",
        "cash:read",
        "cash:manage",
        "customers:read",
        "customers:manage",
        "receivables:read",
        "receivables:manage",
        "reports:read",
        "assistant:use",
      ],
    });

    const activeActor = { ...firstActor, activeBusinessId: created.business.id };
    const emptySummary = await repository.getPreviousMonthSummary(activeActor);
    expect(emptySummary.grossMinorUnits).toBe("0");
    expect(emptySummary.saleCount).toBe("0");
    expect(emptySummary.averageMinorUnits).toBeNull();

    const command = {
      idempotencyKey: crypto.randomUUID(),
      grossMinorUnits: "1250",
      occurredLocalDate: emptySummary.periodStartLocal,
      occurredLocalTime: "12:00",
      description: "Integration sale",
    };
    const [first, concurrentReplay] = await Promise.all([
      repository.createSale(activeActor, command),
      repository.createSale(activeActor, command),
    ]);
    expect([first.replayed, concurrentReplay.replayed].sort()).toEqual([false, true]);
    expect(first.sale.id).toBe(concurrentReplay.sale.id);
    expect(first.sale.currencyMinorUnitDigits).toBe(2);
    expect(first.sale.occurredLocalDate).toBe(command.occurredLocalDate);
    expect(first.sale.occurredLocalTime).toBe(command.occurredLocalTime);
    expect(first.sale.timeZone).toBe("America/El_Salvador");

    const replay = await repository.createSale(activeActor, command);
    expect(replay.replayed).toBe(true);
    expect(replay.sale.id).toBe(first.sale.id);
    await expect(
      repository.createSale(activeActor, { ...command, grossMinorUnits: "1251" }),
    ).rejects.toBeInstanceOf(ProductError);

    const summary = await repository.getPreviousMonthSummary(activeActor);
    expect(summary.grossMinorUnits).toBe("1250");
    expect(summary.saleCount).toBe("1");
    expect(summary.averageMinorUnits).toBe("1250");

    const maximumCommand = {
      ...command,
      grossMinorUnits: "9223372036854775807",
      idempotencyKey: crypto.randomUUID(),
      description: "Maximum integration sale A",
    };
    await repository.createSale(activeActor, maximumCommand);
    await repository.createSale(activeActor, {
      ...maximumCommand,
      idempotencyKey: crypto.randomUUID(),
      description: "Maximum integration sale B",
    });
    const largeSummary = await repository.getPreviousMonthSummary(activeActor);
    expect(largeSummary.grossMinorUnits).toBe("18446744073709552864");
    expect(largeSummary.saleCount).toBe("3");
    expect(largeSummary.averageMinorUnits).toBe("6148914691236517621");

    await database.db.insert(member).values([
      {
        id: crypto.randomUUID(),
        organizationId: created.business.id,
        userId: userIds[4] as string,
        role: "admin",
      },
      {
        id: crypto.randomUUID(),
        organizationId: created.business.id,
        userId: userIds[5] as string,
        role: "member",
      },
      {
        id: crypto.randomUUID(),
        organizationId: created.business.id,
        userId: userIds[6] as string,
        role: "auditor",
      },
    ]);
    await database.db
      .update(session)
      .set({ activeOrganizationId: created.business.id })
      .where(inArray(session.id, sessionIds.slice(3)));

    const adminActor = {
      userId: userIds[4] as string,
      sessionId: sessionIds[3] as string,
      activeBusinessId: created.business.id,
    };
    const memberActor = {
      userId: userIds[5] as string,
      sessionId: sessionIds[4] as string,
      activeBusinessId: created.business.id,
    };
    const unsupportedRoleActor = {
      userId: userIds[6] as string,
      sessionId: sessionIds[5] as string,
      activeBusinessId: created.business.id,
    };

    expect((await repository.listBusinesses(adminActor)).items[0]?.access).toEqual({
      role: "admin",
      permissions: [
        "business:read",
        "sales:create",
        "sales:read",
        "sales:summary:read",
        "sales:correct",
        "catalog:read",
        "catalog:manage",
        "inventory:read",
        "inventory:manage",
        "expenses:read",
        "expenses:manage",
        "cash:read",
        "cash:manage",
        "customers:read",
        "customers:manage",
        "receivables:read",
        "receivables:manage",
        "reports:read",
        "assistant:use",
      ],
    });
    expect((await repository.listBusinesses(memberActor)).items[0]?.access).toEqual({
      role: "member",
      permissions: [
        "business:read",
        "sales:create",
        "sales:read",
        "sales:summary:read",
        "catalog:read",
        "inventory:read",
        "assistant:use",
      ],
    });
    expect(await repository.listBusinesses(unsupportedRoleActor)).toEqual({
      activeBusinessId: null,
      items: [],
    });
    await expect(
      repository.createBusiness(adminActor, {
        name: created.business.name,
        currency: created.business.currency,
        timeZone: created.business.timeZone,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const adminSale = await repository.createSale(adminActor, {
      idempotencyKey: crypto.randomUUID(),
      grossMinorUnits: "200",
      occurredLocalDate: emptySummary.periodStartLocal,
      occurredLocalTime: "12:01",
      description: "Admin integration sale",
    });
    const memberSale = await repository.createSale(memberActor, {
      idempotencyKey: crypto.randomUUID(),
      grossMinorUnits: "300",
      occurredLocalDate: emptySummary.periodStartLocal,
      occurredLocalTime: "12:02",
      description: "Member integration sale",
    });
    expect((await repository.getSale(adminActor, memberSale.sale.id)).id).toBe(memberSale.sale.id);
    expect((await repository.getSale(memberActor, adminSale.sale.id)).id).toBe(adminSale.sale.id);
    expect((await repository.getPreviousMonthSummary(adminActor)).saleCount).toBe("5");
    expect((await repository.getPreviousMonthSummary(memberActor)).saleCount).toBe("5");
    await expect(
      repository.voidSale(memberActor, adminSale.sale.id, {
        idempotencyKey: crypto.randomUUID(),
        reason: "Member should not be allowed",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const voidCommand = {
      idempotencyKey: crypto.randomUUID(),
      reason: "Duplicate admin sale",
    };
    const voided = await repository.voidSale(activeActor, adminSale.sale.id, voidCommand);
    expect(voided.replayed).toBe(false);
    expect(voided.correction.kind).toBe("void");
    expect(voided.originalSale.status).toBe("voided");
    expect(voided.originalSale.correction?.id).toBe(voided.correction.id);
    expect(voided.replacementSale).toBeNull();
    expect((await repository.voidSale(activeActor, adminSale.sale.id, voidCommand)).replayed).toBe(
      true,
    );
    await expect(
      repository.voidSale(activeActor, adminSale.sale.id, {
        ...voidCommand,
        reason: "Changed correction command",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const replacementCommand = {
      idempotencyKey: crypto.randomUUID(),
      reason: "Correct member sale amount",
      replacement: {
        grossMinorUnits: "350",
        occurredLocalDate: emptySummary.periodStartLocal,
        occurredLocalTime: "12:02",
        description: "Corrected member integration sale",
      },
    };
    const replaced = await repository.replaceSale(
      adminActor,
      memberSale.sale.id,
      replacementCommand,
    );
    expect(replaced.replayed).toBe(false);
    expect(replaced.correction.kind).toBe("replacement");
    expect(replaced.originalSale.status).toBe("voided");
    expect(replaced.replacementSale?.status).toBe("posted");
    expect(replaced.replacementSale?.correction?.originalSaleId).toBe(memberSale.sale.id);
    expect(
      (await repository.replaceSale(adminActor, memberSale.sale.id, replacementCommand)).replayed,
    ).toBe(true);
    const replacementSaleId = replaced.replacementSale?.id;
    expect(replacementSaleId).toBeTruthy();
    await expect(
      repository.voidSale(activeActor, replacementSaleId as string, {
        idempotencyKey: crypto.randomUUID(),
        reason: "Attempt to correct a replacement",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await repository.getSale(memberActor, memberSale.sale.id)).correction?.id).toBe(
      replaced.correction.id,
    );
    expect(
      (await repository.getSale(memberActor, replacementSaleId as string)).correction?.id,
    ).toBe(replaced.correction.id);
    const correctedSummary = await repository.getPreviousMonthSummary(activeActor);
    expect(correctedSummary.saleCount).toBe("4");
    expect(correctedSummary.grossMinorUnits).toBe("18446744073709553214");
    await expect(
      repository.createSale(unsupportedRoleActor, {
        idempotencyKey: crypto.randomUUID(),
        grossMinorUnits: "400",
        occurredLocalDate: emptySummary.periodStartLocal,
        occurredLocalTime: "12:03",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(repository.getSale(unsupportedRoleActor, first.sale.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(repository.getPreviousMonthSummary(unsupportedRoleActor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const secondActor = {
      userId: userIds[1] as string,
      sessionId: sessionIds[1] as string,
      activeBusinessId: null,
    };
    const secondBusiness = await repository.createBusiness(secondActor, {
      name: `Other Integration Store ${runId.slice(0, 8)}`,
      currency: "USD",
      timeZone: "America/El_Salvador",
    });
    businessIds.push(secondBusiness.business.id);
    await database.db
      .update(session)
      .set({ activeOrganizationId: secondBusiness.business.id })
      .where(eq(session.id, sessionIds[0] as string));
    await expect(
      repository.createSale(activeActor, {
        idempotencyKey: crypto.randomUUID(),
        grossMinorUnits: "100",
        occurredLocalDate: emptySummary.periodStartLocal,
        occurredLocalTime: "12:04",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await database.db
      .update(session)
      .set({ activeOrganizationId: created.business.id })
      .where(eq(session.id, sessionIds[0] as string));
    await expect(
      repository.getSale(
        { ...secondActor, activeBusinessId: secondBusiness.business.id },
        first.sale.id,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await database.db
      .update(member)
      .set({ role: "member" })
      .where(eq(member.organizationId, secondBusiness.business.id));
    const unapprovedMembership = await repository.listBusinesses({
      ...secondActor,
      activeBusinessId: secondBusiness.business.id,
    });
    expect(unapprovedMembership.activeBusinessId).toBe(secondBusiness.business.id);
    expect(unapprovedMembership.items[0]?.access.role).toBe("member");

    const rows = await database.db
      .select({ id: sale.id })
      .from(sale)
      .where(eq(sale.id, first.sale.id));
    expect(rows).toHaveLength(1);

    await database.db
      .update(member)
      .set({ role: "auditor" })
      .where(
        and(
          eq(member.organizationId, created.business.id),
          eq(member.userId, userIds[0] as string),
        ),
      );
    await expect(repository.getSale(activeActor, first.sale.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(repository.getPreviousMonthSummary(activeActor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await database.db
      .update(member)
      .set({ role: "owner" })
      .where(
        and(
          eq(member.organizationId, created.business.id),
          eq(member.userId, userIds[0] as string),
        ),
      );
    await database.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(session.id, sessionIds[0] as string));
    await expect(repository.getSale(activeActor, first.sale.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repository.getPreviousMonthSummary(activeActor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("sale history list on PostgreSQL 18", () => {
  const tiedCreatedAt = new Date("2026-01-02T03:04:05.000Z");
  const occurredLocalDate = "2026-08-22";
  let listBusinessId: string;
  let otherBusinessId: string;
  let ownerActor: ProductActor;
  let otherActor: ProductActor;
  let auditorActor: ProductActor;
  let expiredActor: ProductActor;
  let postedIds: string[];
  let tiedIds: string[];
  let microsecondIds: string[];
  let otherSaleId: string;

  async function collectIds(
    actor: ProductActor,
    status: "posted" | "voided" | "all",
    limit: number,
  ): Promise<string[]> {
    const ids: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await repository.listSales(actor, { cursor, limit, status });
      ids.push(...page.items.map(({ id }) => id));
      cursor = page.nextCursor ?? undefined;
      pages += 1;
      if (pages > 20) throw new Error("Sale list paging did not terminate");
    } while (cursor);
    return ids;
  }

  beforeAll(async () => {
    const created = await repository.createBusiness(
      {
        userId: userIds[7] as string,
        sessionId: sessionIds[6] as string,
        activeBusinessId: null,
      },
      {
        name: `List Store ${runId.slice(0, 8)}`,
        currency: "USD",
        timeZone: "America/El_Salvador",
      },
    );
    listBusinessId = created.business.id;
    businessIds.push(listBusinessId);
    ownerActor = {
      userId: userIds[7] as string,
      sessionId: sessionIds[6] as string,
      activeBusinessId: listBusinessId,
    };

    const other = await repository.createBusiness(
      {
        userId: userIds[8] as string,
        sessionId: sessionIds[7] as string,
        activeBusinessId: null,
      },
      {
        name: `Other List Store ${runId.slice(0, 8)}`,
        currency: "USD",
        timeZone: "America/El_Salvador",
      },
    );
    otherBusinessId = other.business.id;
    businessIds.push(otherBusinessId);
    otherActor = {
      userId: userIds[8] as string,
      sessionId: sessionIds[7] as string,
      activeBusinessId: otherBusinessId,
    };

    await database.db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: listBusinessId,
      userId: userIds[9] as string,
      role: "auditor",
    });
    await database.db
      .update(session)
      .set({ activeOrganizationId: listBusinessId })
      .where(inArray(session.id, [sessionIds[8] as string, sessionIds[9] as string]));
    auditorActor = {
      userId: userIds[9] as string,
      sessionId: sessionIds[8] as string,
      activeBusinessId: listBusinessId,
    };
    expiredActor = {
      userId: userIds[7] as string,
      sessionId: sessionIds[9] as string,
      activeBusinessId: listBusinessId,
    };

    postedIds = [];
    for (const index of [1, 2, 3, 4, 5]) {
      const posted = await repository.createSale(ownerActor, {
        idempotencyKey: crypto.randomUUID(),
        grossMinorUnits: `${index}00`,
        occurredLocalDate,
        occurredLocalTime: `10:0${index}`,
        description: `List sale ${index}`,
      });
      postedIds.push(posted.sale.id);
    }
    otherSaleId = (
      await repository.createSale(otherActor, {
        idempotencyKey: crypto.randomUUID(),
        grossMinorUnits: "900",
        occurredLocalDate,
        occurredLocalTime: "10:09",
        description: "Other tenant sale",
      })
    ).sale.id;

    const tied = await database.db
      .insert(sale)
      .values(
        [1, 2].map((index) => ({
          businessId: listBusinessId,
          grossMinorUnits: BigInt(index * 10),
          currency: "USD",
          currencyMinorUnitDigits: 2,
          occurredAt: tiedCreatedAt,
          occurredLocalDate,
          occurredLocalTime: "03:04",
          timeZone: "America/El_Salvador",
          description: `Same-instant sale ${index}`,
          createdByUserId: userIds[7] as string,
          createdAt: tiedCreatedAt,
        })),
      )
      .returning({ id: sale.id });
    tiedIds = tied.map(({ id }) => id).sort((left, right) => (left < right ? 1 : -1));

    // Real rows come from now(), which carries microseconds a JavaScript Date cannot
    // hold. These three share one millisecond so a truncating cursor drops the later two.
    const microsecond = await database.db.execute<{ id: string }>(sql`
      insert into ${sale}
        (business_id, gross_minor_units, currency, currency_minor_unit_digits, occurred_at,
         occurred_local_date, occurred_local_time, time_zone, description, created_by_user_id,
         created_at)
      select ${listBusinessId}, 30, 'USD', 2, timestamptz '2026-01-03T04:05:06.500000Z',
             ${occurredLocalDate}, '04:05', 'America/El_Salvador', 'Microsecond sale ' || suffix,
             ${userIds[7] as string}, stamp
      from (values
        ('a', timestamptz '2026-01-03T04:05:06.500999Z'),
        ('b', timestamptz '2026-01-03T04:05:06.500500Z'),
        ('c', timestamptz '2026-01-03T04:05:06.500000Z')
      ) as seeded(suffix, stamp)
      returning id
    `);
    microsecondIds = microsecond.map(({ id }) => id);
  });

  test("pages one deterministic keyset without a duplicate or a gap", async () => {
    const single = await repository.listSales(ownerActor, { limit: 50, status: "all" });
    const paged = await collectIds(ownerActor, "all", 2);

    expect(single.items).toHaveLength(postedIds.length + tiedIds.length + microsecondIds.length);
    expect(single.nextCursor).toBeNull();
    expect(paged).toEqual(single.items.map(({ id }) => id));
    expect(new Set(paged).size).toBe(paged.length);
    expect(paged.slice(0, 5)).toEqual([...postedIds].reverse());
    expect(single.queriedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("breaks a same-instant tie by identifier so no row is skipped", async () => {
    const page = await repository.listSales(ownerActor, { limit: 50, status: "all" });
    const tail = page.items.slice(-2).map(({ id }) => id);
    const pagedTail = (await collectIds(ownerActor, "all", 1)).slice(-2);

    expect(tail).toEqual(tiedIds);
    expect(pagedTail).toEqual(tiedIds);
  });

  test("pages sales that differ only in microseconds without dropping one", async () => {
    const single = await repository.listSales(ownerActor, { limit: 50, status: "all" });
    const paged = await collectIds(ownerActor, "all", 1);
    const inSingle = single.items.map(({ id }) => id).filter((id) => microsecondIds.includes(id));
    const inPaged = paged.filter((id) => microsecondIds.includes(id));

    expect(inSingle).toHaveLength(microsecondIds.length);
    expect(inPaged).toEqual(inSingle);
  });

  test("keeps a corrected sale visible and reports its correction truthfully", async () => {
    const originalId = postedIds[0] as string;
    const replaced = await repository.replaceSale(ownerActor, originalId, {
      idempotencyKey: crypto.randomUUID(),
      reason: "Wrong amount",
      replacement: {
        grossMinorUnits: "1500",
        occurredLocalDate,
        occurredLocalTime: "11:00",
        description: "Corrected list sale",
      },
    });
    const replacementId = replaced.replacementSale?.id as string;

    const all = await repository.listSales(ownerActor, { limit: 50, status: "all" });
    const posted = await repository.listSales(ownerActor, { limit: 50, status: "posted" });
    const voided = await repository.listSales(ownerActor, { limit: 50, status: "voided" });
    const original = all.items.find(({ id }) => id === originalId);
    const replacement = all.items.find(({ id }) => id === replacementId);
    const untouched = all.items.find(({ id }) => id === postedIds[1]);

    expect(original?.status).toBe("voided");
    expect(original?.correction).toMatchObject({
      id: replaced.correction.id,
      kind: "replacement",
      originalSaleId: originalId,
      reason: "Wrong amount",
      replacementSaleId: replacementId,
    });
    expect(replacement?.status).toBe("posted");
    expect(replacement?.correction?.id).toBe(replaced.correction.id);
    expect(untouched?.correction).toBeNull();
    expect(voided.items.map(({ id }) => id)).toEqual([originalId]);
    expect(posted.items.map(({ id }) => id)).not.toContain(originalId);
    expect(posted.items.map(({ id }) => id)).toContain(replacementId);
    // The original is voided and its replacement takes its place, so the count holds.
    expect(posted.items).toHaveLength(postedIds.length + tiedIds.length + microsecondIds.length);
    expect(await collectIds(ownerActor, "posted", 2)).toEqual(posted.items.map(({ id }) => id));
  });

  test("never serves another tenant's rows, even from a cursor that tenant minted", async () => {
    const ownerPage = await repository.listSales(ownerActor, { limit: 1, status: "all" });
    expect(ownerPage.nextCursor).not.toBeNull();

    const replayed = await repository.listSales(otherActor, {
      cursor: ownerPage.nextCursor as string,
      limit: 50,
      status: "all",
    });
    const otherOwn = await repository.listSales(otherActor, { limit: 50, status: "all" });

    expect(otherOwn.items.map(({ id }) => id)).toEqual([otherSaleId]);
    expect(replayed.items.map(({ id }) => id)).not.toContain(ownerPage.items[0]?.id);
    for (const item of replayed.items)
      expect(otherOwn.items.map(({ id }) => id)).toContain(item.id);
  });

  test("refuses a cursor minted for a different filter instead of dropping rows", async () => {
    const allCursor = await repository.listSales(ownerActor, { limit: 1, status: "all" });

    await expect(
      repository.listSales(ownerActor, {
        cursor: allCursor.nextCursor as string,
        limit: 50,
        status: "posted",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      repository.listSales(ownerActor, { cursor: "not base64url", limit: 50, status: "all" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("denies a role without sales:read and an expired session", async () => {
    await expect(
      repository.listSales(auditorActor, { limit: 25, status: "all" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      repository.listSales(expiredActor, { limit: 25, status: "all" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      repository.listSales({ ...ownerActor, activeBusinessId: null }, { limit: 25, status: "all" }),
    ).rejects.toMatchObject({ code: "BUSINESS_REQUIRED" });
  });

  test("bounds the page size in the repository, not only at the route", async () => {
    await expect(
      repository.listSales(ownerActor, { limit: 51, status: "all" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      repository.listSales(ownerActor, { limit: 0, status: "all" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      repository.listSales(ownerActor, { limit: 25, status: "corrected" } as never),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  test("answers each status filter from a business index without sorting rows", async () => {
    const plans = await database.db.transaction(async (tx) => {
      // Both settings only discourage their node; a plan that still contains a
      // Sort would mean the index cannot satisfy this ordering on its own.
      await tx.execute(sql`set local enable_seqscan = off`);
      await tx.execute(sql`set local enable_sort = off`);
      const readPlan = async (statement: ReturnType<typeof sql>): Promise<string> => {
        const rows = await tx.execute<{ "QUERY PLAN": string }>(statement);
        return rows.map((row) => row["QUERY PLAN"]).join("\n");
      };
      return {
        all: await readPlan(sql`
          explain (costs off) select * from ${sale}
          where ${sale.businessId} = ${listBusinessId}
          order by ${sale.createdAt} desc, ${sale.id} desc
          limit 26
        `),
        voided: await readPlan(sql`
          explain (costs off) select * from ${sale}
          where ${sale.businessId} = ${listBusinessId} and ${sale.status} = 'voided'
          order by ${sale.createdAt} desc, ${sale.id} desc
          limit 26
        `),
      };
    });

    expect(plans.all).toContain("sale_business_created_at_idx");
    expect(plans.all).not.toContain("Sort");
    expect(plans.voided).toContain("sale_business_status_created_at_idx");
    expect(plans.voided).not.toContain("Sort");
  });
});
