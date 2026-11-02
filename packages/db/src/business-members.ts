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
import { businessMemberOperation } from "./schema/members.ts";

/**
 * Creates sign-in accounts for staff. `packages/auth` implements it with the sign-up endpoint, so
 * email normalization, the password policy and hashing are exactly the sign-up ones.
 */
export interface StaffAccountProvisioner {
  /**
   * Creates a password account and leaves no session behind. `created: false` means another
   * request created an account with this email first.
   */
  createPasswordAccount(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ created: true; userId: string } | { created: false }>;
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
 * Locks a membership row of the active business. Its holder's in-flight commands keep it FOR SHARE,
 * so a role change or removal waits for them and applies from their next request.
 */
async function lockTargetMember(
  tx: DatabaseTransaction,
  businessId: string,
  memberId: string,
  strength: "no key update" | "update",
) {
  const [target] = await tx
    .select({
      email: user.email,
      id: member.id,
      name: user.name,
      role: member.role,
      userId: member.userId,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, businessId), eq(member.id, memberId)))
    .limit(1)
    .for(strength, { of: member });
  if (!target) throw new ProductError("NOT_FOUND", "Member was not found");
  return target;
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
      // The password stays out of the receipt: an unsalted digest of it could be brute-forced.
      const commandFingerprint = await fingerprintCommand(action, payload);
      const begin = (tx: DatabaseTransaction) =>
        beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: memberOperationLog,
          permissions: configure,
          snapshot: addedMemberSchema,
        });

      const enrolledExisting = await db.transaction(async (tx) => {
        const { access, identity, replay } = await begin(tx);
        if (replay) return { ...replay, replayed: true };
        await lockSemanticKey(tx, "business-member", access.businessId, payload.email);
        const account = await findAccount(tx, payload.email);
        if (!account) return null;
        const result = await enroll(tx, {
          access,
          account,
          identity,
          kind: "existing",
          role: payload.role,
        });
        return { ...result, replayed: false };
      });
      if (enrolledExisting) return enrolledExisting;

      // Account creation commits on its own, so no transaction or lock is held across it; the
      // command is authorized and replayed again before the membership is written.
      const provisioned = await accounts.createPasswordAccount({
        email: payload.email,
        name: payload.name,
        password: initialPassword,
      });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await begin(tx);
        if (replay) return { ...replay, replayed: true };
        await lockSemanticKey(tx, "business-member", access.businessId, payload.email);
        const account = await findAccount(tx, payload.email);
        if (!account) throw new Error("The provisioned account is not readable by its email");
        const created = provisioned.created && provisioned.userId === account.id;
        const result = await enroll(tx, {
          access,
          account,
          identity,
          kind: created ? "created" : "existing",
          role: payload.role,
        });
        return { ...result, replayed: false };
      });
    },

    async changeMemberRole(actor, memberId, rawCommand) {
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

        const target = await lockTargetMember(tx, access.businessId, memberId, "no key update");
        if (target.userId === actor.userId) {
          throw new ProductError("CONFLICT", "You cannot change your own role");
        }
        if (target.role === "owner") {
          throw new ProductError("CONFLICT", "The owner's role cannot be changed");
        }
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

    async removeMember(actor, memberId, rawCommand) {
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

        const target = await lockTargetMember(tx, access.businessId, memberId, "update");
        if (target.userId === actor.userId) {
          throw new ProductError("CONFLICT", "You cannot remove yourself from the business");
        }
        if (target.role === "owner") {
          throw new ProductError("CONFLICT", "The owner cannot be removed from the business");
        }
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
