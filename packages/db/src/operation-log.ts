import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import {
  type AuthorizedBusinessContext,
  authorizeBusinessAction,
  type BusinessLockStrength,
  type DatabaseTransaction,
} from "./business-access.ts";
import { type ProductActor, ProductError } from "./product-core.ts";

/**
 * Shared idempotency plumbing for the append-only operation logs. Every capability
 * keeps its own table, foreign keys, and action CHECK constraint; only the command
 * identity, the advisory lock, and the replay comparison are shared here.
 */

/** Largest value a PostgreSQL `bigint` money or quantity column can hold. */
export const maximumMinorUnits = 9_223_372_036_854_775_807n;

/** Identity of one confirmed command: what ran, who ran it, where, and with which key. */
export interface OperationCommandIdentity<Action extends string = string> {
  action: Action;
  actorUserId: string;
  businessId: string;
  commandFingerprint: string;
  idempotencyKey: string;
}

/**
 * The columns every operation log shares, plus the capability-specific conflict
 * message. Domain tables stay separate because their foreign keys and action
 * constraints differ.
 */
export interface OperationLog {
  readonly action: PgColumn;
  readonly actorUserId: PgColumn;
  readonly businessId: PgColumn;
  readonly commandFingerprint: PgColumn;
  readonly conflictMessage: string;
  readonly idempotencyKey: PgColumn;
  readonly result: PgColumn;
  readonly table: PgTable;
}

export async function sha256Hex(canonical: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Hashes the exact JSON encoding of `value`; key order is part of the fingerprint. */
export function fingerprintValue(value: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(value));
}

/** Canonical `{ version, action, payload }` command fingerprint. */
export function fingerprintCommand(action: string, payload: unknown): Promise<string> {
  return fingerprintValue({ version: 1, action, payload });
}

/**
 * Serializes concurrent retries of one confirmation key inside the transaction, so
 * the replay read below cannot race another commit of the same command.
 */
export async function lockCommandKey(
  tx: DatabaseTransaction,
  key: Pick<OperationCommandIdentity, "actorUserId" | "businessId" | "idempotencyKey">,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${key.businessId}:${key.actorUserId}:${key.idempotencyKey}`}, 0))`,
  );
}

/**
 * Serializes writers competing for one case-insensitive business-scoped name, so a
 * uniqueness read cannot race another transaction's insert of the same value.
 */
export async function lockSemanticKey(
  tx: DatabaseTransaction,
  namespace: string,
  businessId: string,
  value: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${namespace}:${businessId}:${value.toLocaleLowerCase("en-US")}`}, 0))`,
  );
}

/**
 * Returns the stored result when the same actor already committed this exact command,
 * and fails closed when the key was reused for a different action or payload.
 */
export async function findOperationReplay(
  tx: DatabaseTransaction,
  log: OperationLog,
  identity: OperationCommandIdentity,
): Promise<unknown | null> {
  const [receipt] = await tx
    .select({
      action: log.action,
      commandFingerprint: log.commandFingerprint,
      result: log.result,
    })
    .from(log.table)
    .where(
      and(
        eq(log.businessId, identity.businessId),
        eq(log.actorUserId, identity.actorUserId),
        eq(log.idempotencyKey, identity.idempotencyKey),
      ),
    )
    .limit(1);
  if (!receipt) return null;
  if (
    receipt.action !== identity.action ||
    receipt.commandFingerprint !== identity.commandFingerprint
  ) {
    throw new ProductError("IDEMPOTENCY_CONFLICT", log.conflictMessage);
  }
  return receipt.result;
}

/**
 * The prologue every financial command shares: authorize the fresh session and
 * membership first, then take the idempotency lock, then read the replay. The order
 * is deliberate — session, then business membership, then the command key and the
 * resource rows the caller locks next — and reordering it can deadlock.
 */
export async function beginOperation<Action extends string>(
  tx: DatabaseTransaction,
  input: {
    action: Action;
    actor: ProductActor;
    commandFingerprint: string;
    idempotencyKey: string;
    lock: BusinessLockStrength;
    log: OperationLog;
    permissions: readonly BusinessPermission[];
  },
): Promise<{
  access: AuthorizedBusinessContext;
  identity: OperationCommandIdentity<Action>;
  replay: unknown | null;
}> {
  const access = await authorizeBusinessAction(tx, input.actor, input.permissions, input.lock);
  const identity: OperationCommandIdentity<Action> = {
    action: input.action,
    actorUserId: input.actor.userId,
    businessId: access.businessId,
    commandFingerprint: input.commandFingerprint,
    idempotencyKey: input.idempotencyKey,
  };
  await lockCommandKey(tx, identity);
  return { access, identity, replay: await findOperationReplay(tx, input.log, identity) };
}

/** The column values every operation log row shares. */
export function operationIdentityValues<Action extends string>(
  identity: OperationCommandIdentity<Action>,
): {
  action: Action;
  actorUserId: string;
  businessId: string;
  commandFingerprint: string;
  idempotencyKey: string;
} {
  return {
    action: identity.action,
    actorUserId: identity.actorUserId,
    businessId: identity.businessId,
    commandFingerprint: identity.commandFingerprint,
    idempotencyKey: identity.idempotencyKey,
  };
}

/**
 * Reads a stored result back through its public contract. A snapshot that no longer
 * matches is a repository bug, not a user error, so it fails loudly.
 */
export function parseReplaySnapshot<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  snapshot: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(snapshot);
  if (!parsed.success) throw new Error(message);
  return parsed.data;
}
