import type {
  Business,
  BusinessAccess,
  BusinessPermission,
  CreateBusinessRequest,
  CreateSaleRequest,
  PreviousMonthSummary,
  ReplaceSaleRequest,
  Sale,
  SaleCorrection,
  VoidSaleRequest,
} from "@pisto/contracts";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { Database } from "./client.ts";
import {
  hasBusinessPermission,
  resolveBusinessAccess,
  rolesWithBusinessPermission,
} from "./product-access.ts";
import { member, organization, session } from "./schema/auth.ts";
import { businessSettings } from "./schema/business.ts";
import { sale, saleCorrection, saleOperation } from "./schema/sales.ts";

const maximumMinorUnits = 9_223_372_036_854_775_807n;
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));
const localFormatters = new Map<string, Intl.DateTimeFormat>();

export type ProductErrorCode =
  | "BUSINESS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR";

export class ProductError extends Error {
  override readonly name = "ProductError";

  constructor(
    readonly code: ProductErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ProductActor {
  userId: string;
  sessionId: string;
  activeBusinessId: string | null;
}

export interface ProductRepository {
  listBusinesses(actor: ProductActor): Promise<{
    activeBusinessId: string | null;
    items: Business[];
  }>;
  createBusiness(
    actor: ProductActor,
    command: CreateBusinessRequest,
  ): Promise<{ business: Business; replayed: boolean }>;
  createSale(
    actor: ProductActor,
    command: CreateSaleRequest,
  ): Promise<{ sale: Sale; replayed: boolean }>;
  voidSale(
    actor: ProductActor,
    saleId: string,
    command: VoidSaleRequest,
  ): Promise<SaleCorrectionResult>;
  replaceSale(
    actor: ProductActor,
    saleId: string,
    command: ReplaceSaleRequest,
  ): Promise<SaleCorrectionResult>;
  getSale(actor: ProductActor, saleId: string): Promise<Sale>;
  getPreviousMonthSummary(actor: ProductActor): Promise<PreviousMonthSummary>;
}

type SaleRecord = typeof sale.$inferSelect;
type SaleCorrectionRecord = typeof saleCorrection.$inferSelect;

export interface SaleCorrectionResult {
  correction: SaleCorrection;
  originalSale: Sale;
  replacementSale: Sale | null;
  replayed: boolean;
}

function toBusiness(record: {
  access: BusinessAccess;
  businessId: string;
  createdAt: Date;
  currency: string;
  currencyMinorUnitDigits: number;
  name: string;
  timeZone: string;
}): Business {
  return {
    id: record.businessId,
    name: record.name,
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    timeZone: record.timeZone,
    createdAt: record.createdAt.toISOString(),
    access: record.access,
  };
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = localFormatters.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  localFormatters.set(timeZone, formatter);
  return formatter;
}

function localParts(instant: Date, timeZone: string) {
  const values = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(instant)
      .filter(({ type }) => ["year", "month", "day", "hour", "minute"].includes(type))
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isSupportedCurrency(currency: string): boolean {
  return getCurrencyMinorUnitDigits(currency) !== null;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function getCurrencyMinorUnitDigits(currency: string): number | null {
  if (!supportedCurrencies.has(currency)) return null;
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
    return typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 4
      ? digits
      : null;
  } catch {
    return null;
  }
}

export function resolveLocalDateTime(input: {
  date: string;
  time: string;
  timeZone: string;
}): Date {
  if (!isSupportedTimeZone(input.timeZone)) {
    throw new ProductError("VALIDATION_ERROR", "The business time zone is not supported");
  }
  const match = `${input.date}T${input.time}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const [year, month, day, hour, minute] = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const canonical = new Date(naiveUtc);
  if (
    canonical.getUTCFullYear() !== year ||
    canonical.getUTCMonth() !== month - 1 ||
    canonical.getUTCDate() !== day ||
    canonical.getUTCHours() !== hour ||
    canonical.getUTCMinutes() !== minute
  ) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }

  const matches: Date[] = [];
  const expectedDate = input.date;
  const expectedTime = input.time;
  const searchStart = naiveUtc - 14 * 60 * 60_000;
  const searchEnd = naiveUtc + 14 * 60 * 60_000;
  for (let timestamp = searchStart; timestamp <= searchEnd; timestamp += 60_000) {
    const candidate = new Date(timestamp);
    const candidateParts = localParts(candidate, input.timeZone);
    if (candidateParts.date === expectedDate && candidateParts.time === expectedTime) {
      matches.push(candidate);
      if (matches.length > 1) break;
    }
  }
  if (matches.length !== 1) {
    throw new ProductError(
      "VALIDATION_ERROR",
      matches.length === 0
        ? "That local time does not exist in the business time zone"
        : "That local time is ambiguous in the business time zone",
    );
  }
  return matches[0] as Date;
}

function parseMinorUnits(value: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    throw new ProductError("VALIDATION_ERROR", "Sale total must be a positive integer");
  }
  const parsed = BigInt(value);
  if (parsed > maximumMinorUnits) {
    throw new ProductError("VALIDATION_ERROR", "Sale total is too large");
  }
  return parsed;
}

async function fingerprintValue(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function saleFingerprint(command: CreateSaleRequest): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: "sale.posted",
    grossMinorUnits: command.grossMinorUnits,
    occurredLocalDate: command.occurredLocalDate,
    occurredLocalTime: command.occurredLocalTime,
    description: command.description ?? null,
  });
}

function correctionFingerprint(
  saleId: string,
  input:
    | { kind: "void"; command: VoidSaleRequest }
    | { kind: "replacement"; command: ReplaceSaleRequest },
): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: input.kind === "void" ? "sale.voided" : "sale.replaced",
    saleId,
    reason: input.command.reason,
    replacement: input.kind === "replacement" ? input.command.replacement : null,
  });
}

function toCorrection(record: SaleCorrectionRecord): SaleCorrection {
  return {
    id: record.id,
    kind: record.kind === "replacement" ? "replacement" : "void",
    reason: record.reason,
    originalSaleId: record.originalSaleId,
    replacementSaleId: record.replacementSaleId,
    correctedAt: record.createdAt.toISOString(),
  };
}

function toSale(record: SaleRecord, correction: SaleCorrection | null = null): Sale {
  return {
    id: record.id,
    status: record.status === "voided" ? "voided" : "posted",
    entryMode: "total_only",
    grossMinorUnits: record.grossMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    description: record.description,
    correction,
    createdAt: record.createdAt.toISOString(),
  };
}

function requireActiveBusiness(actor: ProductActor): string {
  if (!actor.activeBusinessId) {
    throw new ProductError("BUSINESS_REQUIRED", "Select or create a business before continuing");
  }
  return actor.activeBusinessId;
}

function requireBusinessPermission(role: string, permission: BusinessPermission): BusinessAccess {
  const access = resolveBusinessAccess(role);
  if (!access?.permissions.includes(permission)) {
    throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
  }
  return access;
}

function businessSlug(name: string, id: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "business"}-${id.slice(0, 8)}`;
}

export function createProductRepository(db: Database): ProductRepository {
  async function correctSale(
    actor: ProductActor,
    saleId: string,
    input:
      | { kind: "void"; command: VoidSaleRequest }
      | { kind: "replacement"; command: ReplaceSaleRequest },
  ): Promise<SaleCorrectionResult> {
    const businessId = requireActiveBusiness(actor);
    const reason = input.command.reason.trim();
    if (reason.length < 2 || reason.length > 240) {
      throw new ProductError("VALIDATION_ERROR", "Correction reason must be 2 to 240 characters");
    }
    const replacementMinorUnits =
      input.kind === "replacement"
        ? parseMinorUnits(input.command.replacement.grossMinorUnits)
        : null;
    const commandFingerprint = await correctionFingerprint(saleId, {
      ...input,
      command: { ...input.command, reason },
    } as typeof input);

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${businessId}:${actor.userId}:${input.command.idempotencyKey}`}, 0))`,
      );

      const [activeSession] = await tx
        .select({ id: session.id })
        .from(session)
        .where(
          and(
            eq(session.id, actor.sessionId),
            eq(session.userId, actor.userId),
            sql`${session.expiresAt} > transaction_timestamp()`,
          ),
        )
        .limit(1)
        .for("update");
      if (!activeSession) {
        throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
      }

      const [access] = await tx
        .select({
          currency: businessSettings.currency,
          currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
          role: member.role,
          timeZone: businessSettings.timeZone,
        })
        .from(member)
        .innerJoin(businessSettings, eq(businessSettings.businessId, member.organizationId))
        .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
        .limit(1)
        .for("update");
      if (!access) {
        throw new ProductError("FORBIDDEN", "The active business membership is no longer valid");
      }
      requireBusinessPermission(access.role, "sales:correct");

      const [existingPostedOperation] = await tx
        .select({ id: saleOperation.id })
        .from(saleOperation)
        .where(
          and(
            eq(saleOperation.businessId, businessId),
            eq(saleOperation.actorUserId, actor.userId),
            eq(saleOperation.idempotencyKey, input.command.idempotencyKey),
          ),
        )
        .limit(1);
      if (existingPostedOperation) {
        throw new ProductError(
          "IDEMPOTENCY_CONFLICT",
          "That confirmation key was already used for another sale operation",
        );
      }

      const [existingCorrection] = await tx
        .select()
        .from(saleCorrection)
        .where(
          and(
            eq(saleCorrection.businessId, businessId),
            eq(saleCorrection.actorUserId, actor.userId),
            eq(saleCorrection.idempotencyKey, input.command.idempotencyKey),
          ),
        )
        .limit(1);

      if (existingCorrection) {
        if (existingCorrection.commandFingerprint !== commandFingerprint) {
          throw new ProductError(
            "IDEMPOTENCY_CONFLICT",
            "That confirmation key was already used for a different correction",
          );
        }
        const ids = [
          existingCorrection.originalSaleId,
          existingCorrection.replacementSaleId,
        ].filter((id): id is string => id !== null);
        const records = await tx
          .select()
          .from(sale)
          .where(and(eq(sale.businessId, businessId), inArray(sale.id, ids)));
        const originalRecord = records.find(({ id }) => id === existingCorrection.originalSaleId);
        const replacementRecord = records.find(
          ({ id }) => id === existingCorrection.replacementSaleId,
        );
        if (!originalRecord || (existingCorrection.replacementSaleId && !replacementRecord)) {
          throw new Error("Sale correction references missing canonical records");
        }
        const correction = toCorrection(existingCorrection);
        return {
          correction,
          originalSale: toSale(originalRecord, correction),
          replacementSale: replacementRecord ? toSale(replacementRecord, correction) : null,
          replayed: true,
        };
      }

      const [originalRecord] = await tx
        .select()
        .from(sale)
        .where(and(eq(sale.businessId, businessId), eq(sale.id, saleId)))
        .limit(1)
        .for("update");
      if (!originalRecord) throw new ProductError("NOT_FOUND", "Sale was not found");
      const [relatedCorrection] = await tx
        .select({ id: saleCorrection.id })
        .from(saleCorrection)
        .where(
          and(
            eq(saleCorrection.businessId, businessId),
            or(
              eq(saleCorrection.originalSaleId, saleId),
              eq(saleCorrection.replacementSaleId, saleId),
            ),
          ),
        )
        .limit(1);
      if (relatedCorrection) {
        throw new ProductError("CONFLICT", "A corrected sale cannot be corrected again");
      }
      if (originalRecord.status !== "posted") {
        throw new ProductError("CONFLICT", "Only a posted sale can be corrected");
      }

      let replacementRecord: SaleRecord | null = null;
      if (input.kind === "replacement") {
        const replacement = input.command.replacement;
        const occurredAt = resolveLocalDateTime({
          date: replacement.occurredLocalDate,
          time: replacement.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [createdReplacement] = await tx
          .insert(sale)
          .values({
            businessId,
            grossMinorUnits: replacementMinorUnits as bigint,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: replacement.occurredLocalDate,
            occurredLocalTime: replacement.occurredLocalTime,
            timeZone: access.timeZone,
            description: replacement.description ?? null,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!createdReplacement) throw new Error("Replacement sale insert returned no record");
        replacementRecord = createdReplacement;
      }

      const [voidedOriginal] = await tx
        .update(sale)
        .set({ status: "voided" })
        .where(and(eq(sale.businessId, businessId), eq(sale.id, saleId), eq(sale.status, "posted")))
        .returning();
      if (!voidedOriginal) {
        throw new ProductError("CONFLICT", "The sale was corrected by another operation");
      }

      const [createdCorrection] = await tx
        .insert(saleCorrection)
        .values({
          businessId,
          originalSaleId: saleId,
          replacementSaleId: replacementRecord?.id ?? null,
          actorUserId: actor.userId,
          idempotencyKey: input.command.idempotencyKey,
          commandFingerprint,
          kind: input.kind,
          reason,
        })
        .returning();
      if (!createdCorrection) throw new Error("Sale correction insert returned no record");

      const correction = toCorrection(createdCorrection);
      return {
        correction,
        originalSale: toSale(voidedOriginal, correction),
        replacementSale: replacementRecord ? toSale(replacementRecord, correction) : null,
        replayed: false,
      };
    });
  }

  return {
    async listBusinesses(actor) {
      const records = await db
        .select({
          businessId: businessSettings.businessId,
          createdAt: businessSettings.createdAt,
          currency: businessSettings.currency,
          currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
          name: organization.name,
          role: member.role,
          timeZone: businessSettings.timeZone,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .innerJoin(businessSettings, eq(businessSettings.businessId, organization.id))
        .where(
          and(
            eq(member.userId, actor.userId),
            inArray(member.role, [...rolesWithBusinessPermission("business:read")]),
          ),
        )
        .orderBy(businessSettings.createdAt);
      const items = records.flatMap((record) => {
        const access = resolveBusinessAccess(record.role);
        return access ? [toBusiness({ ...record, access })] : [];
      });
      return {
        activeBusinessId: items.some(({ id }) => id === actor.activeBusinessId)
          ? actor.activeBusinessId
          : null,
        items,
      };
    },

    async createBusiness(actor, command) {
      if (!isSupportedCurrency(command.currency)) {
        throw new ProductError("VALIDATION_ERROR", "Currency is not a supported ISO 4217 code");
      }
      const currencyMinorUnitDigits = getCurrencyMinorUnitDigits(command.currency);
      if (currencyMinorUnitDigits === null) {
        throw new ProductError("VALIDATION_ERROR", "Currency precision is not supported");
      }
      if (!isSupportedTimeZone(command.timeZone)) {
        throw new ProductError("VALIDATION_ERROR", "Time zone is not a supported IANA identifier");
      }
      return db.transaction(async (tx) => {
        const [databaseTimeZone] = await tx.execute<{ supported: boolean }>(sql`
          select exists(
            select 1 from pg_timezone_names where name = ${command.timeZone}
          ) as supported
        `);
        if (!databaseTimeZone?.supported) {
          throw new ProductError("VALIDATION_ERROR", "Time zone is not supported by the database");
        }
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.userId}, 0))`);
        const existingMemberships = await tx
          .select({
            businessId: organization.id,
            createdAt: organization.createdAt,
            currency: businessSettings.currency,
            currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
            name: organization.name,
            role: member.role,
            timeZone: businessSettings.timeZone,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .leftJoin(businessSettings, eq(businessSettings.businessId, organization.id))
          .where(eq(member.userId, actor.userId))
          .limit(2);

        if (existingMemberships.length > 1) {
          throw new ProductError(
            "CONFLICT",
            "This account already belongs to multiple organizations",
          );
        }
        const existing = existingMemberships[0];

        if (existing) {
          const canConfigure = hasBusinessPermission(existing.role, "business:configure");
          if (
            existing.currency === null ||
            existing.currencyMinorUnitDigits === null ||
            existing.timeZone === null
          ) {
            if (!canConfigure) {
              throw new ProductError(
                "FORBIDDEN",
                "The business membership does not permit configuration",
              );
            }
            const [membershipCount] = await tx
              .select({ value: sql<number>`count(*)::int` })
              .from(member)
              .where(eq(member.organizationId, existing.businessId));
            if (membershipCount?.value !== 1) {
              throw new ProductError(
                "CONFLICT",
                "The existing organization cannot be adopted safely",
              );
            }
            await tx
              .update(organization)
              .set({ name: command.name })
              .where(eq(organization.id, existing.businessId));
            await tx.insert(businessSettings).values({
              businessId: existing.businessId,
              currency: command.currency,
              currencyMinorUnitDigits,
              timeZone: command.timeZone,
            });
            const activated = await tx
              .update(session)
              .set({ activeOrganizationId: existing.businessId })
              .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
              .returning({ id: session.id });
            if (activated.length !== 1) {
              throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
            }
            return {
              business: toBusiness({
                access: requireBusinessPermission(existing.role, "business:configure"),
                businessId: existing.businessId,
                createdAt: existing.createdAt,
                currency: command.currency,
                currencyMinorUnitDigits,
                name: command.name,
                timeZone: command.timeZone,
              }),
              replayed: false,
            };
          }
          if (!canConfigure) {
            throw new ProductError(
              "FORBIDDEN",
              "The business membership does not permit configuration",
            );
          }
          if (
            existing.name === command.name &&
            existing.currency === command.currency &&
            existing.timeZone === command.timeZone
          ) {
            const activated = await tx
              .update(session)
              .set({ activeOrganizationId: existing.businessId })
              .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
              .returning({ id: session.id });
            if (activated.length !== 1) {
              throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
            }
            return {
              business: toBusiness({
                access: requireBusinessPermission(existing.role, "business:configure"),
                businessId: existing.businessId,
                createdAt: existing.createdAt,
                currency: existing.currency,
                currencyMinorUnitDigits: existing.currencyMinorUnitDigits,
                name: existing.name,
                timeZone: existing.timeZone,
              }),
              replayed: true,
            };
          }
          throw new ProductError("CONFLICT", "This account already belongs to a business");
        }

        const businessId = crypto.randomUUID();
        const [createdOrganization] = await tx
          .insert(organization)
          .values({
            id: businessId,
            name: command.name,
            slug: businessSlug(command.name, businessId),
          })
          .returning({ createdAt: organization.createdAt });
        if (!createdOrganization) throw new Error("Organization insert returned no record");
        await tx.insert(businessSettings).values({
          businessId,
          currency: command.currency,
          currencyMinorUnitDigits,
          timeZone: command.timeZone,
        });
        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: businessId,
          userId: actor.userId,
          role: "owner",
        });
        const updatedSessions = await tx
          .update(session)
          .set({ activeOrganizationId: businessId })
          .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
          .returning({ id: session.id });
        if (updatedSessions.length !== 1) {
          throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
        }
        return {
          business: toBusiness({
            access: requireBusinessPermission("owner", "business:configure"),
            businessId,
            createdAt: createdOrganization.createdAt,
            currency: command.currency,
            currencyMinorUnitDigits,
            name: command.name,
            timeZone: command.timeZone,
          }),
          replayed: false,
        };
      });
    },

    async createSale(actor, command) {
      const businessId = requireActiveBusiness(actor);
      const grossMinorUnits = parseMinorUnits(command.grossMinorUnits);
      const commandFingerprint = await saleFingerprint(command);

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`${businessId}:${actor.userId}:${command.idempotencyKey}`}, 0))`,
        );
        const [activeSession] = await tx
          .select({ id: session.id })
          .from(session)
          .where(
            and(
              eq(session.id, actor.sessionId),
              eq(session.userId, actor.userId),
              sql`${session.expiresAt} > transaction_timestamp()`,
            ),
          )
          .limit(1)
          .for("update");
        if (!activeSession) {
          throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
        }
        const [access] = await tx
          .select({
            businessId: businessSettings.businessId,
            currency: businessSettings.currency,
            currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
            name: organization.name,
            role: member.role,
            timeZone: businessSettings.timeZone,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .innerJoin(businessSettings, eq(businessSettings.businessId, organization.id))
          .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
          .limit(1)
          .for("update");
        if (!access) {
          throw new ProductError("FORBIDDEN", "The active business membership is no longer valid");
        }
        requireBusinessPermission(access.role, "sales:create");

        const [existingCorrectionOperation] = await tx
          .select({ id: saleCorrection.id })
          .from(saleCorrection)
          .where(
            and(
              eq(saleCorrection.businessId, businessId),
              eq(saleCorrection.actorUserId, actor.userId),
              eq(saleCorrection.idempotencyKey, command.idempotencyKey),
            ),
          )
          .limit(1);
        if (existingCorrectionOperation) {
          throw new ProductError(
            "IDEMPOTENCY_CONFLICT",
            "That confirmation key was already used for another sale operation",
          );
        }

        const [existingOperation] = await tx
          .select({
            commandFingerprint: saleOperation.commandFingerprint,
            record: sale,
          })
          .from(saleOperation)
          .innerJoin(
            sale,
            and(eq(sale.id, saleOperation.saleId), eq(sale.businessId, saleOperation.businessId)),
          )
          .where(
            and(
              eq(saleOperation.businessId, businessId),
              eq(saleOperation.actorUserId, actor.userId),
              eq(saleOperation.idempotencyKey, command.idempotencyKey),
            ),
          )
          .limit(1);
        if (existingOperation) {
          if (existingOperation.commandFingerprint !== commandFingerprint) {
            throw new ProductError(
              "IDEMPOTENCY_CONFLICT",
              "That confirmation key was already used for a different sale",
            );
          }
          return { sale: toSale(existingOperation.record), replayed: true };
        }

        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [createdSale] = await tx
          .insert(sale)
          .values({
            businessId,
            grossMinorUnits,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            description: command.description ?? null,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!createdSale) throw new Error("Sale insert returned no record");
        await tx.insert(saleOperation).values({
          businessId,
          saleId: createdSale.id,
          actorUserId: actor.userId,
          idempotencyKey: command.idempotencyKey,
          commandFingerprint,
          action: "sale.posted",
        });
        return { sale: toSale(createdSale), replayed: false };
      });
    },

    voidSale(actor, saleId, command) {
      return correctSale(actor, saleId, { kind: "void", command });
    },

    replaceSale(actor, saleId, command) {
      return correctSale(actor, saleId, { kind: "replacement", command });
    },

    async getSale(actor, saleId) {
      const businessId = requireActiveBusiness(actor);
      const [result] = await db
        .select({ record: sale, role: member.role })
        .from(sale)
        .innerJoin(businessSettings, eq(businessSettings.businessId, sale.businessId))
        .innerJoin(
          member,
          and(eq(member.organizationId, sale.businessId), eq(member.userId, actor.userId)),
        )
        .innerJoin(
          session,
          and(
            eq(session.id, actor.sessionId),
            eq(session.userId, actor.userId),
            sql`${session.expiresAt} > transaction_timestamp()`,
          ),
        )
        .where(and(eq(sale.businessId, businessId), eq(sale.id, saleId)))
        .limit(1);
      if (!result) throw new ProductError("NOT_FOUND", "Sale was not found");
      requireBusinessPermission(result.role, "sales:read");
      const [correctionRecord] = await db
        .select()
        .from(saleCorrection)
        .where(
          and(
            eq(saleCorrection.businessId, businessId),
            or(
              eq(saleCorrection.originalSaleId, saleId),
              eq(saleCorrection.replacementSaleId, saleId),
            ),
          ),
        )
        .limit(1);
      return toSale(result.record, correctionRecord ? toCorrection(correctionRecord) : null);
    },

    async getPreviousMonthSummary(actor) {
      const businessId = requireActiveBusiness(actor);
      type SummaryRow = {
        average_minor_units: string | null;
        currency: string;
        currency_minor_unit_digits: number;
        gross_minor_units: string;
        period_end_local_exclusive: string;
        period_end_utc_exclusive: Date | string;
        period_start_local: string;
        period_start_utc: Date | string;
        queried_at: Date | string;
        sale_count: string;
        time_zone: string;
      };
      const rows = await db.execute<SummaryRow>(sql`
        with authorized as (
          select
            ${businessSettings.businessId} as business_id,
            ${businessSettings.currency} as currency,
            ${businessSettings.currencyMinorUnitDigits} as currency_minor_unit_digits,
            ${businessSettings.timeZone} as time_zone
          from ${businessSettings}
          inner join ${member}
            on ${member.organizationId} = ${businessSettings.businessId}
            and ${member.userId} = ${actor.userId}
            and ${inArray(member.role, [...rolesWithBusinessPermission("sales:summary:read")])}
          inner join ${session}
            on ${session.id} = ${actor.sessionId}
            and ${session.userId} = ${actor.userId}
            and ${session.expiresAt} > transaction_timestamp()
          where ${businessSettings.businessId} = ${businessId}
        ), clock as (
          select transaction_timestamp() as queried_at
        ), bounds as (
          select
            queried_at,
            date_trunc('month', queried_at at time zone authorized.time_zone) - interval '1 month' as start_local,
            date_trunc('month', queried_at at time zone authorized.time_zone) as end_local
          from clock, authorized
        ), instants as (
          select
            queried_at,
            start_local,
            end_local,
            start_local at time zone authorized.time_zone as start_utc,
            end_local at time zone authorized.time_zone as end_utc
          from bounds, authorized
        ), totals as (
          select
            coalesce(sum(${sale.grossMinorUnits}), 0::numeric) as gross,
            count(${sale.id})::bigint as sale_count
          from authorized
          cross join instants
          left join ${sale}
            on ${sale.businessId} = authorized.business_id
            and ${sale.status} = 'posted'
            and ${sale.occurredAt} >= instants.start_utc
            and ${sale.occurredAt} < instants.end_utc
        )
        select
          to_char(instants.start_local, 'YYYY-MM-DD') as period_start_local,
          to_char(instants.end_local, 'YYYY-MM-DD') as period_end_local_exclusive,
          instants.start_utc as period_start_utc,
          instants.end_utc as period_end_utc_exclusive,
          instants.queried_at as queried_at,
          authorized.currency as currency,
          authorized.currency_minor_unit_digits as currency_minor_unit_digits,
          authorized.time_zone as time_zone,
          totals.gross::text as gross_minor_units,
          totals.sale_count::text as sale_count,
          case
            when totals.sale_count = 0 then null
            else floor(totals.gross / totals.sale_count + 0.5)::text
          end as average_minor_units
        from authorized, instants, totals
      `);
      const row = rows[0];
      if (!row) {
        throw new ProductError("FORBIDDEN", "The active business access is no longer valid");
      }
      return {
        periodStartLocal: row.period_start_local,
        periodEndLocalExclusive: row.period_end_local_exclusive,
        periodStartUtc: new Date(row.period_start_utc).toISOString(),
        periodEndUtcExclusive: new Date(row.period_end_utc_exclusive).toISOString(),
        timeZone: row.time_zone,
        currency: row.currency,
        currencyMinorUnitDigits: row.currency_minor_unit_digits,
        grossMinorUnits: row.gross_minor_units,
        saleCount: row.sale_count,
        averageMinorUnits: row.average_minor_units,
        queriedAt: new Date(row.queried_at).toISOString(),
      };
    },
  };
}
