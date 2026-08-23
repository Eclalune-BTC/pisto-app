import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";
import { type ProductActor, ProductError } from "../product.ts";
import { hasBusinessPermission } from "../product-access.ts";
import { member, session } from "../schema/auth.ts";
import { businessSettings } from "../schema/business.ts";
import { cashAccount, cashMovement, cashOperationReceipt } from "../schema/cash.ts";
import type {
  AuthorizedBusiness,
  CashAccountRecord,
  CashOperationAction,
  CashTransaction,
} from "./types.ts";

export function requireActiveBusiness(actor: ProductActor): string {
  if (!actor.activeBusinessId) {
    throw new ProductError("BUSINESS_REQUIRED", "Select or create a business before continuing");
  }
  return actor.activeBusinessId;
}

export async function requireAccess(
  tx: CashTransaction,
  actor: ProductActor,
  permissions: readonly BusinessPermission[],
): Promise<AuthorizedBusiness> {
  const businessId = requireActiveBusiness(actor);
  const [activeSession] = await tx
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.id, actor.sessionId),
        eq(session.userId, actor.userId),
        eq(session.activeOrganizationId, businessId),
        sql`${session.expiresAt} > transaction_timestamp()`,
      ),
    )
    .limit(1)
    .for("share");
  if (!activeSession) {
    throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
  }

  const [access] = await tx
    .select({
      businessId: businessSettings.businessId,
      currency: businessSettings.currency,
      currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
      queriedAt: sql<Date>`transaction_timestamp()`,
      role: member.role,
      timeZone: businessSettings.timeZone,
    })
    .from(member)
    .innerJoin(businessSettings, eq(businessSettings.businessId, member.organizationId))
    .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
    .limit(1)
    .for("share");
  if (!access) {
    throw new ProductError("FORBIDDEN", "The active business membership is no longer valid");
  }
  for (const permission of permissions) {
    if (!hasBusinessPermission(access.role, permission)) {
      throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
    }
  }
  return access;
}

export function requireCurrency(access: AuthorizedBusiness, currency: string): void {
  if (currency !== access.currency) {
    throw new ProductError(
      "CONFLICT",
      "The confirmed currency does not match the business currency",
    );
  }
}

export async function lockIdempotencyKey(
  tx: CashTransaction,
  businessId: string,
  actorUserId: string,
  idempotencyKey: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${businessId}:${actorUserId}:${idempotencyKey}`}, 0))`,
  );
}

export async function findReplay(
  tx: CashTransaction,
  input: {
    action: CashOperationAction;
    actorUserId: string;
    businessId: string;
    commandFingerprint: string;
    idempotencyKey: string;
  },
): Promise<unknown | null> {
  const [receipt] = await tx
    .select({
      action: cashOperationReceipt.action,
      commandFingerprint: cashOperationReceipt.commandFingerprint,
      result: cashOperationReceipt.result,
    })
    .from(cashOperationReceipt)
    .where(
      and(
        eq(cashOperationReceipt.businessId, input.businessId),
        eq(cashOperationReceipt.actorUserId, input.actorUserId),
        eq(cashOperationReceipt.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (!receipt) return null;
  if (receipt.action !== input.action || receipt.commandFingerprint !== input.commandFingerprint) {
    throw new ProductError(
      "IDEMPOTENCY_CONFLICT",
      "That confirmation key was already used for a different cash operation",
    );
  }
  return receipt.result;
}

export async function saveReceipt(
  tx: CashTransaction,
  input: {
    action: CashOperationAction;
    actorUserId: string;
    businessId: string;
    commandFingerprint: string;
    idempotencyKey: string;
    resourceId: string;
    result: object;
  },
): Promise<void> {
  await tx.insert(cashOperationReceipt).values(input);
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
