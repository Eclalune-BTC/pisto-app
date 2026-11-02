import {
  type AddBusinessMemberRequest,
  addBusinessMemberRequestSchema,
  type BusinessMember,
  type BusinessMemberAccount,
  businessMemberAccountSchema,
  businessMemberSchema,
  type ChangeBusinessMemberRoleRequest,
  changeBusinessMemberRoleRequestSchema,
  type RemoveBusinessMemberRequest,
  removeBusinessMemberRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type {
  AuthorizedBusinessContext,
  DatabaseTransaction,
  ProductActor,
} from "./business-access.ts";
import type { Database } from "./client.ts";
import { ProductError, parseInput } from "./errors.ts";
import {
  beginOperation,
  fingerprintCommand,
  lockSemanticKey,
  type OperationCommandIdentity,
  type OperationLog,
  saveOperation,
} from "./operation-log.ts";
import { member, user } from "./schema/auth.ts";
import { businessMemberAccountIntent, businessMemberOperation } from "./schema/members.ts";

/**
 * Creates sign-in accounts for staff. `packages/auth` implements it with the sign-up endpoint, so
 * email normalization, the password policy and hashing are exactly the sign-up ones.
 */
export interface StaffAccountProvisioner {
  /**
   * Makes sure a password account exists for the email and leaves no session behind. An account
   * that a concurrent request created first is not an error.
   */
  createPasswordAccount(input: { email: string; name: string; password: string }): Promise<void>;
  /**
   * A keyed digest of an initial password for the command fingerprint. The key never reaches the
   * database, so a stored fingerprint cannot be brute-forced back into the password.
   */
  fingerprintPassword(password: string): Promise<string>;
}

export interface BusinessMembersRepository {
  /** Adds a person to the active business; only a role that configures the business may. */
  addMember(
    actor: ProductActor,
    command: AddBusinessMemberRequest,
  ): Promise<{ account: BusinessMemberAccount; member: BusinessMember; replayed: boolean }>;
  /** Makes a member an admin or a seller. The owner's role never changes. */
  changeMemberRole(
    actor: ProductActor,
    memberId: string,
    command: ChangeBusinessMemberRoleRequest,
  ): Promise<{ member: BusinessMember; replayed: boolean }>;
  /** Takes a member out of the business. Their next request no longer finds a membership. */
  removeMember(
    actor: ProductActor,
    memberId: string,
    command: RemoveBusinessMemberRequest,
  ): Promise<{ member: BusinessMember; replayed: boolean }>;
}

const memberOperationLog = {
  conflictMessage: "That confirmation key was already used for a different staff change",
  result: businessMemberOperation.resultSnapshot,
  table: businessMemberOperation,
} satisfies OperationLog<typeof businessMemberOperation>;

const addedMemberSchema = z.object({
  member: businessMemberSchema,
  account: businessMemberAccountSchema,
});

const configure = ["business:configure"] as const;

type AddedMember = Awaited<ReturnType<BusinessMembersRepository["addMember"]>>;

/** Account lookup by the normalized email, the same exact match Better Auth's sign-in uses. */
async function findAccount(tx: DatabaseTransaction, email: string) {
  const [account] = await tx
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return account ?? null;
}

async function enroll(
  tx: DatabaseTransaction,
  input: {
    access: AuthorizedBusinessContext;
    account: { email: string; id: string; name: string };
    identity: OperationCommandIdentity;
    kind: BusinessMemberAccount;
    role: AddBusinessMemberRequest["role"];
  },
) {
  const [existing] = await tx
    .select({ id: member.id })
    .from(member)
    .where(
      and(eq(member.organizationId, input.access.businessId), eq(member.userId, input.account.id)),
    )
    .limit(1);
  if (existing) throw new ProductError("CONFLICT", "That account already belongs to this business");
  const memberId = crypto.randomUUID();
  await tx.insert(member).values({
    id: memberId,
    organizationId: input.access.businessId,
    userId: input.account.id,
    role: input.role,
  });
  const result = {
    member: {
      id: memberId,
      name: input.account.name,
      email: input.account.email,
      role: input.role,
    },
    account: input.kind,
  };
  await saveOperation(tx, memberOperationLog, input.identity, {
    memberId,
    resultSnapshot: result,
  });
  return result;
}

/**
 * Whether an earlier attempt of this key found no account and went on to create one. The attempt
 * must be this exact command: its account was created with that attempt's password and email.
 */
async function createdByThisCommand(
  tx: DatabaseTransaction,
  identity: OperationCommandIdentity,
): Promise<boolean> {
  const [intent] = await tx
    .select({ commandFingerprint: businessMemberAccountIntent.commandFingerprint })
    .from(businessMemberAccountIntent)
    .where(
      and(
        eq(businessMemberAccountIntent.businessId, identity.businessId),
        eq(businessMemberAccountIntent.actorUserId, identity.actorUserId),
        eq(businessMemberAccountIntent.idempotencyKey, identity.idempotencyKey),
      ),
    )
    .limit(1);
  if (!intent) return false;
  if (intent.commandFingerprint !== identity.commandFingerprint) {
    throw new ProductError("IDEMPOTENCY_CONFLICT", memberOperationLog.conflictMessage);
  }
  return true;
}

/**
 * Locks a membership row of the active business that the actor may change. Its holder's in-flight
 * commands keep it FOR SHARE, so a role change or removal waits for them and applies from their
 * next request. The owner and the actor are refused before the lock: the actor already holds its
 * own row FOR SHARE, and two such requests upgrading it would deadlock each other.
 */
async function lockTargetMember(
  tx: DatabaseTransaction,
  input: {
    actor: ProductActor;
    businessId: string;
    memberId: string;
    refusals: { owner: string; self: string };
    strength: "no key update" | "update";
  },
) {
  const query = () =>
    tx
      .select({
        email: user.email,
        id: member.id,
        name: user.name,
        role: member.role,
        userId: member.userId,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, input.businessId), eq(member.id, input.memberId)))
      .limit(1);
  const refuse = (target: { role: string; userId: string } | undefined) => {
    if (!target) throw new ProductError("NOT_FOUND", "Member was not found");
    if (target.userId === input.actor.userId) {
      throw new ProductError("CONFLICT", input.refusals.self);
    }
    if (target.role === "owner") throw new ProductError("CONFLICT", input.refusals.owner);
  };
  refuse((await query())[0]);
  const [locked] = await query().for(input.strength, { of: member });
  refuse(locked);
  if (!locked) throw new Error("The refused target check let a missing member through");
  return locked;
}

export function createBusinessMembersRepository(
  db: Database,
  accounts: StaffAccountProvisioner,
): BusinessMembersRepository {
  return {
    async addMember(actor, rawCommand) {
      const command = parseInput(
        addBusinessMemberRequestSchema,
        rawCommand,
        "Staff member details are invalid",
      );
      const { idempotencyKey, initialPassword, ...payload } = command;
      const action = "member.added";
      const commandFingerprint = await fingerprintCommand(action, {
        ...payload,
        initialPassword: await accounts.fingerprintPassword(initialPassword),
      });
      /**
       * Replays, or adds the account when it exists. An account this command had to create is
       * reported as created on every later attempt, including a retry after a partial failure.
       */
      const enrollExisting = async (
        tx: DatabaseTransaction,
      ): Promise<AddedMember | { missing: OperationCommandIdentity }> => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: memberOperationLog,
          permissions: configure,
          snapshot: addedMemberSchema,
        });
        if (replay) return { ...replay, replayed: true };
        await lockSemanticKey(tx, "business-member", access.businessId, payload.email);
        const account = await findAccount(tx, payload.email);
        if (!account) return { missing: identity };
        const created = await createdByThisCommand(tx, identity);
        const result = await enroll(tx, {
          access,
          account,
          identity,
          kind: created ? "created" : "existing",
          role: payload.role,
        });
        return { ...result, replayed: false };
      };

      const first = await db.transaction(async (tx) => {
        const outcome = await enrollExisting(tx);
        if (!("missing" in outcome)) return outcome;
        const { actorUserId, businessId, idempotencyKey: key } = outcome.missing;
        // No account has this email yet, so the intent follows the latest body sent under the key.
        await tx
          .insert(businessMemberAccountIntent)
          .values({
            actorUserId,
            businessId,
            commandFingerprint,
            email: payload.email,
            idempotencyKey: key,
          })
          .onConflictDoUpdate({
            target: [
              businessMemberAccountIntent.businessId,
              businessMemberAccountIntent.actorUserId,
              businessMemberAccountIntent.idempotencyKey,
            ],
            set: { commandFingerprint, email: payload.email },
          });
        return null;
      });
      if (first) return first;

      // Account creation commits on its own, so no transaction or lock is held across it; the
      // command is authorized and replayed again before the membership is written.
      await accounts.createPasswordAccount({
        email: payload.email,
        name: payload.name,
        password: initialPassword,
      });

      return db.transaction(async (tx) => {
        const outcome = await enrollExisting(tx);
        if ("missing" in outcome) {
          throw new Error("The provisioned account is not readable by its email");
        }
        return outcome;
      });
    },

    async changeMemberRole(actor, rawMemberId, rawCommand) {
      const memberId = rawMemberId.toLowerCase();
      const command = parseInput(
        changeBusinessMemberRoleRequestSchema,
        rawCommand,
        "Role change is invalid",
      );
      const action = "member.role_changed";
      const commandFingerprint = await fingerprintCommand(action, { memberId, role: command.role });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: memberOperationLog,
          permissions: configure,
          snapshot: businessMemberSchema,
        });
        if (replay) return { member: replay, replayed: true };

        const target = await lockTargetMember(tx, {
          actor,
          businessId: access.businessId,
          memberId,
          refusals: {
            owner: "The owner's role cannot be changed",
            self: "You cannot change your own role",
          },
          strength: "no key update",
        });
        if (target.role !== command.role) {
          await tx
            .update(member)
            .set({ role: command.role })
            .where(and(eq(member.organizationId, access.businessId), eq(member.id, memberId)));
        }
        const result = {
          id: target.id,
          name: target.name,
          email: target.email,
          role: command.role,
        };
        await saveOperation(tx, memberOperationLog, identity, {
          memberId,
          resultSnapshot: result,
        });
        return { member: result, replayed: false };
      });
    },

    async removeMember(actor, rawMemberId, rawCommand) {
      const memberId = rawMemberId.toLowerCase();
      const command = parseInput(
        removeBusinessMemberRequestSchema,
        rawCommand,
        "Member removal is invalid",
      );
      const action = "member.removed";
      const commandFingerprint = await fingerprintCommand(action, { memberId });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: memberOperationLog,
          permissions: configure,
          snapshot: businessMemberSchema,
        });
        if (replay) return { member: replay, replayed: true };

        const target = await lockTargetMember(tx, {
          actor,
          businessId: access.businessId,
          memberId,
          refusals: {
            owner: "The owner cannot be removed from the business",
            self: "You cannot remove yourself from the business",
          },
          strength: "update",
        });
        await tx
          .delete(member)
          .where(and(eq(member.organizationId, access.businessId), eq(member.id, memberId)));
        const result = {
          id: target.id,
          name: target.name,
          email: target.email,
          role: target.role,
        };
        await saveOperation(tx, memberOperationLog, identity, {
          memberId,
          resultSnapshot: result,
        });
        return { member: result, replayed: false };
      });
    },
  };
}
