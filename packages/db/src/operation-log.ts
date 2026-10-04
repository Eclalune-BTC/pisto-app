import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, getTableName, sql } from "drizzle-orm";
import type { PgColumn, PgInsertValue, PgTable } from "drizzle-orm/pg-core";

import {
  type AuthorizedBusinessContext,
  authorizeBusinessAction,
  type DatabaseTransaction,
  type ProductActor,
} from "./business-access.ts";
import { ProductError } from "./errors.ts";

/**
 * Shared idempotency plumbing for the append-only operation logs. Every capability
 * keeps its own table, foreign keys, and action CHECK constraint; only the command
 * identity, the advisory lock, the replay comparison, and the receipt write are
 * shared here.
 */

export interface OperationCommandIdentity<Action extends string = string> {
  action: Action;
  actorUserId: string;
  businessId: string;
  commandFingerprint: string;
  idempotencyKey: string;
}

type OperationIdentityColumns = {
  action: PgColumn;
  actorUserId: PgColumn;
  businessId: PgColumn;
  commandFingerprint: PgColumn;
  idempotencyKey: PgColumn;
};

export type OperationLogTable = PgTable & OperationIdentityColumns;

/**
 * The identity columns are read from the table rather than listed beside it. A
 * descriptor that named them separately could point `businessId` at another
 * column of the same table, which typechecks, generates a predicate that never
 * matches, and silently re-executes the command on every retry.
 */
export interface OperationLog<
  Table extends OperationLogTable = OperationLogTable,
  ResultColumn extends PgColumn & { _: { tableName: Table["_"]["name"] } } = PgColumn & {
    _: { tableName: Table["_"]["name"] };
  },
> {
  readonly conflictMessage: string;
  readonly result: ResultColumn;
  readonly table: Table;
}

type SnapshotSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

export async function sha256Hex(canonical: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Hashes the exact JSON encoding of `value`; key order is part of the fingerprint. */
export function fingerprintValue(value: unknown): Promise<string> {
  return sha256Hex(JSON.stringify(value));
}

export function fingerprintCommand(action: string, payload: unknown): Promise<string> {
  return fingerprintValue({ version: 1, action, payload });
}

/**
 * Idempotency keys are UUIDs, which PostgreSQL compares case-insensitively. The
 * advisory lock hashes the text, so every command path must lock the same spelling.
 */
export function normalizeIdempotencyKey(key: string): string {
  return key.toLowerCase();
}

/**
 * Serializes concurrent retries of one confirmation key inside the transaction, so
 * the replay read below cannot race another commit of the same command.
 */
export async function lockCommandKey(
  tx: DatabaseTransaction,
  key: Pick<OperationCommandIdentity, "actorUserId" | "businessId" | "idempotencyKey">,
): Promise<void> {
  const idempotencyKey = normalizeIdempotencyKey(key.idempotencyKey);
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${key.businessId}:${key.actorUserId}:${idempotencyKey}`}, 0))`,
  );
}

/**
 * Serializes writers competing for one case-insensitive business-scoped value, so a
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
 * Reads a stored result back through its public contract. A snapshot that no longer
 * matches is a repository bug, not a user error, so it fails loudly.
 */
export function parseReplaySnapshot<T>(
  schema: SnapshotSchema<T>,
  snapshot: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(snapshot);
  if (!parsed.success) throw new Error(message);
  return parsed.data;
}

/**
 * Returns the stored result when the same actor already committed this exact command,
 * and fails closed when the key was reused for a different action or payload.
 */
async function findOperationReplay<T>(
  tx: DatabaseTransaction,
  log: OperationLog,
  identity: OperationCommandIdentity,
  schema: SnapshotSchema<T>,
): Promise<T | null> {
  const [receipt] = await tx
    .select({
      action: log.table.action,
      commandFingerprint: log.table.commandFingerprint,
      result: log.result,
    })
    .from(log.table as PgTable)
    .where(
      and(
        eq(log.table.businessId, identity.businessId),
        eq(log.table.actorUserId, identity.actorUserId),
        eq(log.table.idempotencyKey, identity.idempotencyKey),
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
  return parseReplaySnapshot(
    schema,
    receipt.result,
    `Stored ${getTableName(log.table)} result does not match its contract`,
  );
}

/**
 * The prologue every confirmed command shares: authorize the fresh session and
 * membership first, then take the idempotency lock, then read the replay. The order
 * is deliberate — session, then business membership, then the command key and the
 * resource rows the caller locks next — and reordering it can deadlock.
 *
 * Sales follow this same lock order but compose replay themselves because posting
 * and correction share a key space across two receipt tables.
 */
export async function beginOperation<Action extends string, Snapshot>(
  tx: DatabaseTransaction,
  input: {
    action: Action;
    actor: ProductActor;
    commandFingerprint: string;
    idempotencyKey: string;
    log: OperationLog;
    permissions: readonly BusinessPermission[];
    /** The contract of the stored result snapshot, exactly as `saveOperation` wrote it. */
    snapshot: SnapshotSchema<Snapshot>;
  },
): Promise<{
  access: AuthorizedBusinessContext;
  identity: OperationCommandIdentity<Action>;
  replay: Snapshot | null;
}> {
  const access = await authorizeBusinessAction(tx, input.actor, input.permissions);
  const identity: OperationCommandIdentity<Action> = {
    action: input.action,
    actorUserId: input.actor.userId,
    businessId: access.businessId,
    commandFingerprint: input.commandFingerprint,
    idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
  };
  await lockCommandKey(tx, identity);
  return {
    access,
    identity,
    replay: await findOperationReplay(tx, input.log, identity, input.snapshot),
  };
}

export async function saveOperation<Table extends OperationLogTable>(
  tx: DatabaseTransaction,
  log: OperationLog<Table>,
  identity: OperationCommandIdentity,
  values: Omit<PgInsertValue<Table>, keyof OperationCommandIdentity>,
): Promise<void> {
  await tx.insert(log.table).values({
    action: identity.action,
    actorUserId: identity.actorUserId,
    businessId: identity.businessId,
    commandFingerprint: identity.commandFingerprint,
    idempotencyKey: identity.idempotencyKey,
    ...values,
  } as PgInsertValue<Table>);
}
