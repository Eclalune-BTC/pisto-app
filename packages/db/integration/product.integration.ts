import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import {
  businessSettings,
  createDatabase,
  createProductRepository,
  member,
  organization,
  ProductError,
  parseDatabaseConfig,
  sale,
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
];
const sessionIds = [
  `integration-session-a-${runId}`,
  `integration-session-b-${runId}`,
  `integration-session-incomplete-${runId}`,
  `integration-session-admin-${runId}`,
  `integration-session-member-${runId}`,
  `integration-session-unsupported-role-${runId}`,
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
  ]);
});

afterAll(async () => {
  if (businessIds.length > 0) {
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
      permissions: ["business:read", "sales:create", "sales:read", "sales:summary:read"],
    });
    expect((await repository.listBusinesses(memberActor)).items[0]?.access).toEqual({
      role: "member",
      permissions: ["business:read", "sales:create", "sales:read", "sales:summary:read"],
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
