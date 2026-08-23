import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { createCashRepository } from "../src/cash.ts";
import { createDatabase } from "../src/client.ts";
import { parseDatabaseConfig } from "../src/env.ts";
import { ProductError } from "../src/product.ts";
import { member, organization, session, user } from "../src/schema/auth.ts";
import { businessSettings } from "../src/schema/business.ts";
import {
  cashAccount,
  cashMovement,
  cashOperationReceipt,
  cashTransfer,
  expense,
} from "../src/schema/cash.ts";

const database = createDatabase({
  ...parseDatabaseConfig(process.env),
  maxConnections: 6,
});
const repository = createCashRepository(database.db);
const runId = crypto.randomUUID();
const businessA = `cash-business-a-${runId}`;
const businessB = `cash-business-b-${runId}`;
const userIds = {
  ownerA: `cash-owner-a-${runId}`,
  ownerB: `cash-owner-b-${runId}`,
  admin: `cash-admin-${runId}`,
  member: `cash-member-${runId}`,
  unsupported: `cash-unsupported-${runId}`,
};
const sessionIds = {
  ownerA: `cash-session-owner-a-${runId}`,
  ownerB: `cash-session-owner-b-${runId}`,
  admin: `cash-session-admin-${runId}`,
  member: `cash-session-member-${runId}`,
  unsupported: `cash-session-unsupported-${runId}`,
};

const actors = {
  ownerA: {
    userId: userIds.ownerA,
    sessionId: sessionIds.ownerA,
    activeBusinessId: businessA,
  },
  ownerB: {
    userId: userIds.ownerB,
    sessionId: sessionIds.ownerB,
    activeBusinessId: businessB,
  },
  admin: {
    userId: userIds.admin,
    sessionId: sessionIds.admin,
    activeBusinessId: businessA,
  },
  member: {
    userId: userIds.member,
    sessionId: sessionIds.member,
    activeBusinessId: businessA,
  },
  unsupported: {
    userId: userIds.unsupported,
    sessionId: sessionIds.unsupported,
    activeBusinessId: businessA,
  },
};

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([name, id]) => ({
      id,
      name: `Cash integration ${name}`,
      email: `${name}-${runId}@example.test`,
      emailVerified: true,
    })),
  );
  await database.db.insert(organization).values([
    { id: businessA, name: "Cash integration A", slug: `cash-a-${runId}` },
    { id: businessB, name: "Cash integration B", slug: `cash-b-${runId}` },
  ]);
  await database.db.insert(businessSettings).values([
    {
      businessId: businessA,
      currency: "USD",
      currencyMinorUnitDigits: 2,
      timeZone: "America/El_Salvador",
    },
    {
      businessId: businessB,
      currency: "EUR",
      currencyMinorUnitDigits: 2,
      timeZone: "America/New_York",
    },
  ]);
  await database.db.insert(member).values([
    {
      id: crypto.randomUUID(),
      organizationId: businessA,
      userId: userIds.ownerA,
      role: "owner",
    },
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
      userId: userIds.unsupported,
      role: "owner,admin",
    },
    {
      id: crypto.randomUUID(),
      organizationId: businessB,
      userId: userIds.ownerB,
      role: "owner",
    },
  ]);
  await database.db.insert(session).values(
    Object.entries(sessionIds).map(([name, id]) => ({
      id,
      token: `${id}-token`,
      userId: userIds[name as keyof typeof userIds],
      activeOrganizationId: name === "ownerB" ? businessB : businessA,
      expiresAt: new Date(Date.now() + 120_000),
    })),
  );
});

afterAll(async () => {
  await database.db
    .delete(cashOperationReceipt)
    .where(inArray(cashOperationReceipt.businessId, [businessA, businessB]));
  await database.db
    .delete(cashMovement)
    .where(inArray(cashMovement.businessId, [businessA, businessB]));
  await database.db
    .delete(cashTransfer)
    .where(inArray(cashTransfer.businessId, [businessA, businessB]));
  await database.db.delete(expense).where(inArray(expense.businessId, [businessA, businessB]));
  await database.db
    .delete(cashAccount)
    .where(inArray(cashAccount.businessId, [businessA, businessB]));
  await database.db
    .delete(businessSettings)
    .where(inArray(businessSettings.businessId, [businessA, businessB]));
  await database.db.delete(member).where(inArray(member.organizationId, [businessA, businessB]));
  await database.db.delete(session).where(inArray(session.id, Object.values(sessionIds)));
  await database.db.delete(organization).where(inArray(organization.id, [businessA, businessB]));
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.close();
});

describe("expenses and cash repository on PostgreSQL 18", () => {
  test("preserves exact tenant, ledger, replay, rollback, permission, and time invariants", async () => {
    const accountKey = crypto.randomUUID();
    const accountCommand = {
      idempotencyKey: accountKey,
      name: "Caja principal",
      kind: "cash" as const,
      allowNegativeBalance: false,
      currency: "USD",
      opening: {
        direction: "in" as const,
        amountMinorUnits: "10000",
        occurredLocalDate: "2026-08-01",
        occurredLocalTime: "08:00",
        reason: "Opening count",
      },
    };
    const [firstAccount, concurrentReplay] = await Promise.all([
      repository.createAccount(actors.ownerA, accountCommand),
      repository.createAccount(actors.ownerA, accountCommand),
    ]);
    expect([firstAccount.replayed, concurrentReplay.replayed].sort()).toEqual([false, true]);
    expect(firstAccount.account.id).toBe(concurrentReplay.account.id);
    expect(firstAccount.account.balanceMinorUnits).toBe("10000");
    expect(firstAccount.account.currency).toBe("USD");
    expect(firstAccount.account.currencyMinorUnitDigits).toBe(2);
    expect(firstAccount.openingMovement?.occurredAt).toBe("2026-08-01T14:00:00.000Z");
    await expect(
      repository.createAccount(actors.ownerA, {
        ...accountCommand,
        opening: { ...accountCommand.opening, amountMinorUnits: "10001" },
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      repository.createAccount(actors.admin, {
        ...accountCommand,
        idempotencyKey: crypto.randomUUID(),
        name: "cAjA PrInCiPaL",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const secondAccount = await repository.createAccount(actors.admin, {
      idempotencyKey: crypto.randomUUID(),
      name: "Banco",
      kind: "bank",
      allowNegativeBalance: false,
      currency: "USD",
      opening: null,
    });
    expect(secondAccount.account.balanceMinorUnits).toBe("0");
    await expect(
      repository.createAccount(actors.member, {
        ...accountCommand,
        idempotencyKey: crypto.randomUUID(),
        name: "Member account",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(repository.listAccounts(actors.member, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(repository.listAccounts(actors.unsupported, {})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      repository.getAccount(actors.ownerB, firstAccount.account.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      repository.recordAdjustment(actors.ownerA, {
        idempotencyKey: crypto.randomUUID(),
        accountId: firstAccount.account.id,
        direction: "out",
        amountMinorUnits: "10001",
        currency: "USD",
        reason: "Protected outflow",
        occurredLocalDate: "2026-08-02",
        occurredLocalTime: "09:00",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await repository.getAccount(actors.ownerA, firstAccount.account.id)).balanceMinorUnits,
    ).toBe("10000");
    await expect(
      repository.recordAdjustment(actors.ownerA, {
        idempotencyKey: crypto.randomUUID(),
        accountId: firstAccount.account.id,
        direction: "in",
        amountMinorUnits: "1",
        currency: "EUR",
        reason: "Wrong currency",
        occurredLocalDate: "2026-08-02",
        occurredLocalTime: "09:00",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const negativeEnabled = await repository.updateAccount(actors.ownerA, firstAccount.account.id, {
      idempotencyKey: crypto.randomUUID(),
      allowNegativeBalance: true,
    });
    expect(negativeEnabled.account.allowNegativeBalance).toBe(true);
    await repository.recordAdjustment(actors.ownerA, {
      idempotencyKey: crypto.randomUUID(),
      accountId: firstAccount.account.id,
      direction: "out",
      amountMinorUnits: "12000",
      currency: "USD",
      reason: "Explicit negative balance",
      occurredLocalDate: "2026-08-03",
      occurredLocalTime: "10:00",
    });
    expect(
      (await repository.getAccount(actors.ownerA, firstAccount.account.id)).balanceMinorUnits,
    ).toBe("-2000");
    await expect(
      repository.updateAccount(actors.ownerA, firstAccount.account.id, {
        idempotencyKey: crypto.randomUUID(),
        allowNegativeBalance: false,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const adjustment = await repository.recordAdjustment(actors.ownerA, {
      idempotencyKey: crypto.randomUUID(),
      accountId: firstAccount.account.id,
      direction: "in",
      amountMinorUnits: "5000",
      currency: "USD",
      reason: "Count correction",
      occurredLocalDate: "2026-08-04",
      occurredLocalTime: "11:00",
    });
    const reversalKey = crypto.randomUUID();
    const reversalCommand = {
      idempotencyKey: reversalKey,
      reason: "Correction entered twice",
      occurredLocalDate: "2026-08-04",
      occurredLocalTime: "11:05",
    };
    const reversal = await repository.reverseAdjustment(
      actors.ownerA,
      adjustment.movement.id,
      reversalCommand,
    );
    const reversalReplay = await repository.reverseAdjustment(
      actors.ownerA,
      adjustment.movement.id,
      reversalCommand,
    );
    expect(reversalReplay.replayed).toBe(true);
    expect(reversalReplay.movement.id).toBe(reversal.movement.id);
    await expect(
      repository.reverseAdjustment(actors.ownerA, adjustment.movement.id, {
        ...reversalCommand,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const transfer = await repository.transfer(actors.admin, {
      idempotencyKey: crypto.randomUUID(),
      fromAccountId: firstAccount.account.id,
      toAccountId: secondAccount.account.id,
      amountMinorUnits: "1000",
      currency: "USD",
      occurredLocalDate: "2026-08-05",
      occurredLocalTime: "12:00",
      note: "Move to bank",
    });
    expect(transfer.movements.map(({ action }) => action).sort()).toEqual([
      "transfer_in",
      "transfer_out",
    ]);
    expect(transfer.movements[0]?.transferId).toBe(transfer.transfer.id);
    expect(transfer.movements[1]?.transferId).toBe(transfer.transfer.id);
    expect(
      (await repository.getAccount(actors.ownerA, secondAccount.account.id)).balanceMinorUnits,
    ).toBe("1000");

    const expenseKey = crypto.randomUUID();
    const expenseCommand = {
      idempotencyKey: expenseKey,
      accountId: firstAccount.account.id,
      category: "rent" as const,
      amountMinorUnits: "700",
      currency: "USD",
      description: "August rent",
      payee: "Landlord",
      occurredLocalDate: "2026-08-06",
      occurredLocalTime: "13:00",
    };
    const [posted, postedReplay] = await Promise.all([
      repository.postExpense(actors.ownerA, expenseCommand),
      repository.postExpense(actors.ownerA, expenseCommand),
    ]);
    expect([posted.replayed, postedReplay.replayed].sort()).toEqual([false, true]);
    expect(posted.expense.id).toBe(postedReplay.expense.id);
    expect(posted.movement.expenseId).toBe(posted.expense.id);
    await expect(
      repository.postExpense(actors.ownerA, { ...expenseCommand, amountMinorUnits: "701" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const voidKey = crypto.randomUUID();
    const voidCommand = {
      idempotencyKey: voidKey,
      reason: "Expense was refunded",
      occurredLocalDate: "2026-08-07",
      occurredLocalTime: "14:00",
    };
    const voided = await repository.voidExpense(actors.admin, posted.expense.id, voidCommand);
    expect(voided.expense.status).toBe("voided");
    expect(voided.movement.reversalOfMovementId).toBe(posted.movement.id);
    expect(
      (await repository.voidExpense(actors.admin, posted.expense.id, voidCommand)).replayed,
    ).toBe(true);
    await expect(
      repository.voidExpense(actors.admin, posted.expense.id, {
        ...voidCommand,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const triggerSuffix = runId.replaceAll("-", "");
    const functionName = `cash_force_rollback_${triggerSuffix}`;
    const triggerName = `cash_force_rollback_trigger_${triggerSuffix}`;
    try {
      await database.client.unsafe(`
        create function "${functionName}"() returns trigger language plpgsql as $$
        begin
          if new.reason = 'Force integration rollback' then
            raise exception 'forced cash movement failure';
          end if;
          return new;
        end;
        $$
      `);
      await database.client.unsafe(`
        create trigger "${triggerName}"
        before insert on "cash_movement"
        for each row execute function "${functionName}"()
      `);
      await expect(
        repository.postExpense(actors.ownerA, {
          ...expenseCommand,
          idempotencyKey: crypto.randomUUID(),
          amountMinorUnits: "50",
          description: "Force integration rollback",
        }),
      ).rejects.toBeTruthy();
      const rolledBackExpenses = await database.db
        .select({ id: expense.id })
        .from(expense)
        .where(
          and(
            eq(expense.businessId, businessA),
            eq(expense.description, "Force integration rollback"),
          ),
        );
      expect(rolledBackExpenses).toHaveLength(0);
    } finally {
      await database.client.unsafe(`drop trigger if exists "${triggerName}" on "cash_movement"`);
      await database.client.unsafe(`drop function if exists "${functionName}"()`);
    }

    await repository.postExpense(actors.ownerA, {
      ...expenseCommand,
      idempotencyKey: crypto.randomUUID(),
      amountMinorUnits: "300",
      description: "Transport supplies",
      category: "transport",
      occurredLocalDate: "2026-08-15",
    });
    const summary = await repository.getExpensePeriodSummary(actors.admin, {
      startLocalDate: "2026-08-01",
      endLocalDate: "2026-08-31",
    });
    expect(summary.totalMinorUnits).toBe("300");
    expect(summary.expenseCount).toBe("1");
    expect(summary.categories).toEqual([
      { category: "transport", amountMinorUnits: "300", expenseCount: "1" },
    ]);
    expect(summary.periodStartUtc).toBe("2026-08-01T06:00:00.000Z");
    expect(summary.periodEndUtcExclusive).toBe("2026-09-01T06:00:00.000Z");

    const otherAccount = await repository.createAccount(actors.ownerB, {
      idempotencyKey: crypto.randomUUID(),
      name: "New York cash",
      kind: "cash",
      allowNegativeBalance: false,
      currency: "EUR",
      opening: null,
    });
    await expect(
      repository.recordAdjustment(actors.ownerB, {
        idempotencyKey: crypto.randomUUID(),
        accountId: otherAccount.account.id,
        direction: "in",
        amountMinorUnits: "100",
        currency: "EUR",
        reason: "Nonexistent local minute",
        occurredLocalDate: "2026-03-08",
        occurredLocalTime: "02:30",
      }),
    ).rejects.toBeInstanceOf(ProductError);

    const archiveKey = crypto.randomUUID();
    const archived = await repository.archiveAccount(actors.ownerA, secondAccount.account.id, {
      idempotencyKey: archiveKey,
    });
    expect(archived.account.status).toBe("archived");
    expect(
      (
        await repository.archiveAccount(actors.ownerA, secondAccount.account.id, {
          idempotencyKey: archiveKey,
        })
      ).replayed,
    ).toBe(true);
    await expect(
      repository.recordAdjustment(actors.ownerA, {
        idempotencyKey: crypto.randomUUID(),
        accountId: secondAccount.account.id,
        direction: "in",
        amountMinorUnits: "1",
        currency: "USD",
        reason: "Archived account mutation",
        occurredLocalDate: "2026-08-20",
        occurredLocalTime: "09:00",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await database.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(session.id, sessionIds.ownerA));
    await expect(
      repository.getAccount(actors.ownerA, firstAccount.account.id),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
