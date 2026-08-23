import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import { authorizeBusinessAction, requireActiveBusiness } from "../business-access.ts";
import {
  beginOperation,
  type OperationCommandIdentity,
  type OperationLog,
  operationIdentityValues,
} from "../operation-log.ts";
import { type ProductActor, ProductError } from "../product.ts";
import { cashAccount, cashMovement, cashOperationReceipt } from "../schema/cash.ts";
import type {
  AuthorizedBusiness,
  CashAccountRecord,
  CashOperationAction,
  CashTransaction,
} from "./types.ts";

export { requireActiveBusiness };

export async function requireAccess(
  tx: CashTransaction,
  actor: ProductActor,
  permissions: readonly BusinessPermission[],
): Promise<AuthorizedBusiness> {
  return authorizeBusinessAction(tx, actor, permissions, "share");
}

export function requireCurrency(access: AuthorizedBusiness, currency: string): void {
  if (currency !== access.currency) {
    throw new ProductError(
      "CONFLICT",
      "The confirmed currency does not match the business currency",
    );
  }
}

export const cashOperationLog = {
  conflictMessage: "That confirmation key was already used for a different cash operation",
  result: cashOperationReceipt.result,
  table: cashOperationReceipt,
} satisfies OperationLog<typeof cashOperationReceipt>;

/** Authorizes the actor, takes the idempotency lock, and reads any stored replay. */
export async function beginCashOperation(
  tx: CashTransaction,
  actor: ProductActor,
  permissions: readonly BusinessPermission[],
  command: {
    action: CashOperationAction;
    commandFingerprint: string;
    idempotencyKey: string;
  },
): Promise<{
  access: AuthorizedBusiness;
  identity: OperationCommandIdentity<CashOperationAction>;
  replay: unknown | null;
}> {
  const { access, identity, replay } = await beginOperation(tx, {
    action: command.action,
    actor,
    commandFingerprint: command.commandFingerprint,
    idempotencyKey: command.idempotencyKey,
    lock: "share",
    log: cashOperationLog,
    permissions,
  });
  return { access, identity, replay: replay === null ? null : replay.result };
}

export async function saveReceipt(
  tx: CashTransaction,
  identity: OperationCommandIdentity<CashOperationAction>,
  outcome: { resourceId: string; result: object },
): Promise<void> {
  await tx.insert(cashOperationReceipt).values({
    ...operationIdentityValues(identity),
    resourceId: outcome.resourceId,
    result: outcome.result,
  });
}

export async function getAccountBalance(
  tx: CashTransaction,
  businessId: string,
  accountId: string,
): Promise<bigint> {
  const [row] = await tx
    .select({ value: sql<string>`coalesce(sum(${cashMovement.deltaMinorUnits}), 0)::text` })
    .from(cashMovement)
    .where(and(eq(cashMovement.businessId, businessId), eq(cashMovement.accountId, accountId)));
  return BigInt(row?.value ?? "0");
}

export async function lockAccount(
  tx: CashTransaction,
  businessId: string,
  accountId: string,
  requireActive: boolean,
): Promise<CashAccountRecord> {
  const [record] = await tx
    .select()
    .from(cashAccount)
    .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.id, accountId)))
    .limit(1)
    .for("update");
  if (!record) throw new ProductError("NOT_FOUND", "Cash account was not found");
  if (requireActive && record.status !== "active") {
    throw new ProductError("CONFLICT", "Cash account is archived");
  }
  return record;
}

export function requireSufficientBalance(
  account: CashAccountRecord,
  balance: bigint,
  outflow: bigint,
): void {
  if (!account.allowNegativeBalance && balance - outflow < 0n) {
    throw new ProductError("CONFLICT", "Cash account has insufficient funds");
  }
}
