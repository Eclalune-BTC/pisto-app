import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray, like } from "drizzle-orm";

import {
  businessMemberOperation,
  businessSettings,
  catalogCategory,
  catalogOperation,
  createBusinessMembersRepository,
  createBusinessRepository,
  createCatalogRepository,
  createDatabase,
  member,
  organization,
  type ProductActor,
  ProductError,
  parseDatabaseConfig,
  type StaffAccountProvisioner,
  session,
  user,
} from "../src/index.ts";

const database = createDatabase({ ...parseDatabaseConfig(process.env), maxConnections: 8 });
const businesses = createBusinessRepository(database.db);
const catalog = createCatalogRepository(database.db);
const runId = crypto.randomUUID();
const emailOf = (key: string) => `members-${key}-${runId}@example.test`;
const userIds = {
  ownerA: `members-owner-a-${runId}`,
  admin: `members-admin-${runId}`,
  seller: `members-seller-${runId}`,
  ownerB: `members-owner-b-${runId}`,
  ownerC: `members-owner-c-${runId}`,
  coOwner: `members-co-owner-${runId}`,
  existing: `members-existing-${runId}`,
};
const businessIds: string[] = [];
let businessA = "";
let businessB = "";
let businessC = "";

const actor = (key: keyof typeof userIds, businessId: string): ProductActor => ({
  userId: userIds[key],
  sessionId: `members-session-${key}-${runId}`,
  activeBusinessId: businessId,
});

/**
 * Stands in for Better Auth's sign-up: it creates the user row, and like sign-up it refuses an
 * email that already has an account.
 */
const provisioned: { email: string; name: string; password: string }[] = [];
let provisionFailure: Error | null = null;
const accounts: StaffAccountProvisioner = {
  async createPasswordAccount(input) {
    provisioned.push(input);
    if (provisionFailure) throw provisionFailure;
    const id = `members-provisioned-${runId}-${crypto.randomUUID()}`;
    const [created] = await database.db
      .insert(user)
      .values({ id, name: input.name, email: input.email, emailVerified: false })
      .onConflictDoNothing({ target: user.email })
      .returning({ id: user.id });
    return created ? { created: true, userId: created.id } : { created: false };
  },
};
const members = createBusinessMembersRepository(database.db, accounts);

/** A signed-in session for an account the owner added, active in the given business. */
async function signIn(email: string, businessId: string): Promise<ProductActor> {
  const [account] = await database.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!account) throw new Error(`No account for ${email}`);
  const sessionId = `members-session-${runId}-${crypto.randomUUID()}`;
  await database.db.insert(session).values({
    id: sessionId,
    token: `members-token-${sessionId}`,
    userId: account.id,
    activeOrganizationId: businessId,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  return { userId: account.id, sessionId, activeBusinessId: businessId };
}

const add = (
  owner: ProductActor,
  overrides: Partial<{
    email: string;
    idempotencyKey: string;
    initialPassword: string;
    name: string;
    role: "admin" | "member";
  }> = {},
) =>
  members.addMember(owner, {
    idempotencyKey: crypto.randomUUID(),
    name: "Daniela Cruz",
    email: emailOf(`new-${crypto.randomUUID().slice(0, 8)}`),
    role: "member",
    initialPassword: "Temporal2026",
    ...overrides,
  });

async function memberIdOf(businessId: string, userId: string): Promise<string> {
  const [row] = await database.db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, businessId), eq(member.userId, userId)));
  if (!row) throw new Error(`No membership for ${userId}`);
  return row.id;
}

beforeAll(async () => {
  await database.db.insert(user).values(
    Object.entries(userIds).map(([key, id]) => ({
      id,
      name: `Members ${key}`,
      email: emailOf(key),
      emailVerified: true,
    })),
  );
  await database.db.insert(session).values(
    Object.keys(userIds).map((key) => ({
      id: `members-session-${key}-${runId}`,
      token: `members-token-${key}-${runId}`,
      userId: userIds[key as keyof typeof userIds],
      expiresAt: new Date(Date.now() + 10 * 60_000),
    })),
  );
  for (const [key, label] of [
    ["ownerA", "A"],
    ["ownerB", "B"],
    ["ownerC", "C"],
  ] as const) {
    const { business } = await businesses.createBusiness(actor(key, ""), {
      name: `Members Store ${label} ${runId.slice(0, 8)}`,
      currency: "USD",
      timeZone: "America/El_Salvador",
    });
    businessIds.push(business.id);
  }
  [businessA, businessB, businessC] = businessIds as [string, string, string];
  await database.db.insert(member).values([
    { id: crypto.randomUUID(), organizationId: businessA, userId: userIds.admin, role: "admin" },
    { id: crypto.randomUUID(), organizationId: businessA, userId: userIds.seller, role: "member" },
    // A second owner exists only to show that no command demotes or removes an owner.
    { id: crypto.randomUUID(), organizationId: businessC, userId: userIds.coOwner, role: "owner" },
  ]);
  for (const key of ["admin", "seller"] as const) {
    await database.db
      .update(session)
      .set({ activeOrganizationId: businessA })
      .where(eq(session.id, actor(key, businessA).sessionId));
  }
});

afterAll(async () => {
  if (businessIds.length > 0) {
    await database.db
      .delete(businessMemberOperation)
      .where(inArray(businessMemberOperation.businessId, businessIds));
    await database.db
      .delete(catalogOperation)
      .where(inArray(catalogOperation.businessId, businessIds));
    await database.db
      .delete(catalogCategory)
      .where(inArray(catalogCategory.businessId, businessIds));
    await database.db.delete(member).where(inArray(member.organizationId, businessIds));
  }
  await database.db.delete(session).where(like(session.id, `members-session-%${runId}%`));
  if (businessIds.length > 0) {
    await database.db
      .delete(businessSettings)
      .where(inArray(businessSettings.businessId, businessIds));
    await database.db.delete(organization).where(inArray(organization.id, businessIds));
  }
  await database.db.delete(user).where(inArray(user.id, Object.values(userIds)));
  await database.db.delete(user).where(like(user.id, `members-provisioned-${runId}-%`));
  await database.close();
});

describe("business staff management on PostgreSQL 18", () => {
  test("only the owner adds, re-roles or removes staff", async () => {
    const sellerMemberId = await memberIdOf(businessA, userIds.seller);
    const before = provisioned.length;
    for (const key of ["admin", "seller"] as const) {
      const denied = actor(key, businessA);
      await expect(add(denied)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        members.changeMemberRole(denied, sellerMemberId, {
          idempotencyKey: crypto.randomUUID(),
          role: "admin",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        members.removeMember(denied, sellerMemberId, { idempotencyKey: crypto.randomUUID() }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    // A refused command never reaches account creation.
    expect(provisioned.length).toBe(before);
    const [seller] = await database.db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.id, sellerMemberId));
    expect(seller?.role).toBe("member");
  });

  test("creates an account for a new email and replays the same command", async () => {
    const owner = actor("ownerA", businessA);
    const email = emailOf("new-created");
    const command = {
      idempotencyKey: crypto.randomUUID(),
      name: "  José Portillo ",
      email: `  ${email.toUpperCase()} `,
      role: "member" as const,
      initialPassword: "Temporal2026",
    };
    const before = provisioned.length;
    const added = await members.addMember(owner, command);
    expect(added).toMatchObject({
      account: "created",
      replayed: false,
      member: { name: "José Portillo", email, role: "member" },
    });
    expect(provisioned.slice(before)).toEqual([
      { email, name: "José Portillo", password: "Temporal2026" },
    ]);

    const replay = await members.addMember(owner, command);
    expect(replay).toEqual({ ...added, replayed: true });
    // The password is not part of the command identity, so it is never stored in any form.
    const otherPassword = await members.addMember(owner, {
      ...command,
      initialPassword: "OtraClave2026",
    });
    expect(otherPassword).toEqual({ ...added, replayed: true });
    expect(provisioned.length).toBe(before + 1);
    const [receipt] = await database.db
      .select({ snapshot: businessMemberOperation.resultSnapshot })
      .from(businessMemberOperation)
      .where(eq(businessMemberOperation.memberId, added.member.id));
    expect(JSON.stringify(receipt?.snapshot)).not.toContain("Temporal2026");

    await expect(members.addMember(owner, { ...command, role: "admin" })).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
    const listed = await businesses.listMembers(owner);
    expect(listed).toContainEqual(added.member);
  });

  test("adds an existing account as it is and refuses a second membership", async () => {
    const before = provisioned.length;
    const added = await add(actor("ownerA", businessA), {
      email: emailOf("existing").toUpperCase(),
      name: "Otro nombre",
      role: "admin",
    });
    expect(added).toMatchObject({
      account: "existing",
      member: { email: emailOf("existing"), name: "Members existing", role: "admin" },
    });
    expect(provisioned.length).toBe(before);

    await expect(
      add(actor("ownerA", businessA), { email: emailOf("existing") }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      add(actor("ownerA", businessA), { email: emailOf("seller") }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Belonging to business A does not stop another owner from adding the same person.
    const elsewhere = await add(actor("ownerB", businessB), { email: emailOf("existing") });
    expect(elsewhere).toMatchObject({ account: "existing", member: { role: "member" } });
  });

  test("a new member works with their role, a role change applies at once and removal ends access", async () => {
    const owner = actor("ownerA", businessA);
    const email = emailOf("new-lifecycle");
    const added = await add(owner, { email, role: "member" });
    const person = await signIn(email, businessA);

    const visible = await businesses.listBusinesses(person);
    expect(visible.activeBusinessId).toBe(businessA);
    expect(visible.items.map(({ id, access }) => ({ id, role: access.role }))).toEqual([
      { id: businessA, role: "member" },
    ]);
    await catalog.listCategories(person, { status: "active", limit: 25 });
    await expect(
      catalog.createCategory(person, { idempotencyKey: crypto.randomUUID(), name: "Bebidas" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const promoted = await members.changeMemberRole(owner, added.member.id, {
      idempotencyKey: crypto.randomUUID(),
      role: "admin",
    });
    expect(promoted).toEqual({ member: { ...added.member, role: "admin" }, replayed: false });
    const category = await catalog.createCategory(person, {
      idempotencyKey: crypto.randomUUID(),
      name: `Staff ${runId.slice(0, 8)}`,
    });
    expect(category.category.name).toBe(`Staff ${runId.slice(0, 8)}`);

    const removal = { idempotencyKey: crypto.randomUUID() };
    const removed = await members.removeMember(owner, added.member.id, removal);
    expect(removed).toEqual({ member: promoted.member, replayed: false });
    await expect(
      catalog.listCategories(person, { status: "active", limit: 25 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await businesses.listBusinesses(person)).items).toEqual([]);
    expect(await members.removeMember(owner, added.member.id, removal)).toEqual({
      ...removed,
      replayed: true,
    });
    await expect(
      members.removeMember(owner, added.member.id, { idempotencyKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("never changes or removes an owner, nor the acting owner", async () => {
    const owner = actor("ownerC", businessC);
    const selfId = await memberIdOf(businessC, userIds.ownerC);
    const coOwnerId = await memberIdOf(businessC, userIds.coOwner);
    const key = () => ({ idempotencyKey: crypto.randomUUID() });
    await expect(
      members.changeMemberRole(owner, selfId, { ...key(), role: "admin" }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "You cannot change your own role" });
    await expect(members.removeMember(owner, selfId, key())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You cannot remove yourself from the business",
    });
    await expect(
      members.changeMemberRole(owner, coOwnerId, { ...key(), role: "member" }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "The owner's role cannot be changed" });
    await expect(members.removeMember(owner, coOwnerId, key())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "The owner cannot be removed from the business",
    });
    await expect(
      members.changeMemberRole(owner, coOwnerId, {
        ...key(),
        role: "owner" as never,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const roles = await database.db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.organizationId, businessC));
    expect(roles.map(({ role }) => role)).toEqual(["owner", "owner"]);
  });

  test("keeps every command inside the active business", async () => {
    const sellerMemberId = await memberIdOf(businessA, userIds.seller);
    const otherOwner = actor("ownerB", businessB);
    await expect(
      members.changeMemberRole(otherOwner, sellerMemberId, {
        idempotencyKey: crypto.randomUUID(),
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      members.removeMember(otherOwner, sellerMemberId, { idempotencyKey: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    // A business the session is not active in is refused before any lookup.
    await expect(
      members.removeMember(actor("ownerA", businessB), sellerMemberId, {
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const people = await businesses.listMembers(otherOwner);
    expect(people.some(({ email }) => email === emailOf("seller"))).toBe(false);
  });

  test("a key names one command: another role or action under it is a conflict", async () => {
    const owner = actor("ownerA", businessA);
    const target = await add(owner, { role: "member" });
    const command = { idempotencyKey: crypto.randomUUID(), role: "admin" as const };
    const changed = await members.changeMemberRole(owner, target.member.id, command);
    expect(await members.changeMemberRole(owner, target.member.id, command)).toEqual({
      ...changed,
      replayed: true,
    });
    await expect(
      members.changeMemberRole(owner, target.member.id, { ...command, role: "member" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      members.removeMember(owner, target.member.id, { idempotencyKey: command.idempotencyKey }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(add(owner, { idempotencyKey: command.idempotencyKey })).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });

  test("a refused account creation writes nothing and the same key can be sent again", async () => {
    const owner = actor("ownerA", businessA);
    const email = emailOf("new-refused");
    const command = {
      idempotencyKey: crypto.randomUUID(),
      name: "Rosa Mejía",
      email,
      role: "member" as const,
      initialPassword: "Temporal2026",
    };
    provisionFailure = new ProductError("VALIDATION_ERROR", "Password policy");
    try {
      await expect(members.addMember(owner, command)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    } finally {
      provisionFailure = null;
    }
    const receipts = await database.db
      .select({ id: businessMemberOperation.id })
      .from(businessMemberOperation)
      .where(eq(businessMemberOperation.idempotencyKey, command.idempotencyKey));
    expect(receipts).toEqual([]);
    expect(await members.addMember(owner, command)).toMatchObject({
      account: "created",
      replayed: false,
      member: { email },
    });
  });

  test("concurrent adds of one email create one membership", async () => {
    const owner = actor("ownerA", businessA);
    const email = emailOf("new-concurrent");
    const sameKey = { idempotencyKey: crypto.randomUUID(), email };
    const retried = await Promise.all([add(owner, sameKey), add(owner, sameKey)]);
    expect(new Set(retried.map(({ member: { id } }) => id)).size).toBe(1);
    expect(retried.map(({ replayed }) => replayed).sort()).toEqual([false, true]);

    const otherEmail = emailOf("new-concurrent-two");
    const outcomes = await Promise.allSettled([
      add(owner, { email: otherEmail }),
      add(owner, { email: otherEmail }),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find(
      (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({ code: "CONFLICT" });
    const accountsWithEmail = await database.db
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.email, [email, otherEmail]));
    expect(accountsWithEmail).toHaveLength(2);
  });
});
