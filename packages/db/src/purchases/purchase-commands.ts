import {
  type BusinessPermission,
  createPurchaseRequestSchema,
  createSupplierPaymentRequestSchema,
  purchaseSchema,
  receivePurchaseRequestSchema,
  voidPurchaseRequestSchema,
} from "@pisto/contracts";
import { and, eq, inArray, sql } from "drizzle-orm";

import {
  appendPurchaseCashMovement,
  requirePurchaseOutflowAccount,
  reversePurchaseCashMovement,
} from "../cash/purchase-ledger.ts";
import { receivePurchaseStock, reversePurchaseStock } from "../catalog/purchase-stock.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { beginOperation, fingerprintCommand, saveOperation } from "../operation-log.ts";
import { catalogProduct } from "../schema/catalog.ts";
import { purchase, purchaseLine, supplierPayment } from "../schema/purchases.ts";
import { lineSubtotalMinorUnits, toSupplierPayment } from "./mappers.ts";
import {
  businessNow,
  currentPurchase,
  getSupplierPaymentsMinorUnits,
  loadLines,
  loadPurchase,
  loadSupplierNames,
  lockSupplier,
  paymentResultSchema,
  purchaseOperationLog,
} from "./records.ts";
import type { PurchaseRecord, PurchasesRepository } from "./types.ts";

const MAX_MINOR_UNITS = 9_223_372_036_854_775_807n;

type PurchaseCommands = Pick<
  PurchasesRepository,
  "createPurchase" | "createSupplierPayment" | "receivePurchase" | "voidPurchase"
>;

/** How a received purchase explains its stock entries: the supplier and the invoice, as recorded. */
function stockReason(supplierName: string, invoiceNumber: string | null): string {
  return invoiceNumber ? `${supplierName} · ${invoiceNumber}` : supplierName;
}

export function createPurchaseCommands(db: Database): PurchaseCommands {
  return {
    async createPurchase(actor, rawCommand) {
      const command = parseInput(
        createPurchaseRequestSchema,
        rawCommand,
        "Purchase details are invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "purchase.posted";
      const commandFingerprint = await fingerprintCommand(action, payload);
      const permissions: BusinessPermission[] = ["purchases:manage"];
      if (command.paymentTerms === "cash") permissions.push("cash:manage");
      if (command.received) permissions.push("inventory:manage");
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: purchaseOperationLog,
          permissions,
          snapshot: purchaseSchema,
        });
        if (replay) return { purchase: replay, replayed: true };

        if (
          command.paymentTerms === "credit" &&
          command.dueDate !== undefined &&
          command.dueDate < command.occurredLocalDate
        ) {
          throw new ProductError("VALIDATION_ERROR", "The due date cannot precede the purchase");
        }
        const supplierRecord = await lockSupplier(
          tx,
          access.businessId,
          command.supplierId,
          "share",
        );
        if (supplierRecord.status === "archived") {
          throw new ProductError("CONFLICT", "An archived supplier cannot receive a new purchase");
        }
        const productIds = [...new Set(command.lines.map(({ productId }) => productId))];
        const productQuery = tx
          .select({
            id: catalogProduct.id,
            name: catalogProduct.name,
            quantityPrecision: catalogProduct.quantityPrecision,
            status: catalogProduct.status,
          })
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, access.businessId),
              inArray(catalogProduct.id, productIds),
            ),
          )
          .orderBy(catalogProduct.id);
        const products = new Map(
          (command.received
            ? await productQuery.for("update")
            : await productQuery.for("share")
          ).map((product) => [product.id, product]),
        );
        const lines = command.lines.map((line, position) => {
          const product = products.get(line.productId);
          if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
          if (product.status === "archived") {
            throw new ProductError("CONFLICT", "An archived product cannot be purchased");
          }
          const quantityMinorUnits = BigInt(line.quantityMinorUnits);
          const unitCostMinorUnits = BigInt(line.unitCostMinorUnits);
          return {
            position,
            productId: product.id,
            productName: product.name,
            quantityMinorUnits,
            quantityPrecision: product.quantityPrecision,
            unitCostMinorUnits,
            subtotalMinorUnits: lineSubtotalMinorUnits(
              quantityMinorUnits,
              unitCostMinorUnits,
              product.quantityPrecision,
            ),
          };
        });
        const totalMinorUnits = lines.reduce((sum, line) => sum + line.subtotalMinorUnits, 0n);
        if (totalMinorUnits > MAX_MINOR_UNITS) {
          throw new ProductError("VALIDATION_ERROR", "The purchase total is too large");
        }
        if (totalMinorUnits <= 0n) {
          throw new ProductError("VALIDATION_ERROR", "A purchase total must be greater than zero");
        }
        const cashAccountId = command.paymentTerms === "cash" ? command.accountId : undefined;
        if (cashAccountId) {
          await requirePurchaseOutflowAccount(tx, access, cashAccountId, totalMinorUnits);
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [record] = await tx
          .insert(purchase)
          .values({
            businessId: access.businessId,
            supplierId: supplierRecord.id,
            invoiceNumber: command.invoiceNumber ?? null,
            entrySource: command.entrySource,
            paymentTerms: command.paymentTerms,
            cashAccountId: cashAccountId ?? null,
            totalMinorUnits,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            dueDate: command.paymentTerms === "credit" ? (command.dueDate ?? null) : null,
            note: command.note ?? null,
            receivedAt: command.received ? occurredAt : null,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!record) throw new Error("Purchase insert returned no record");
        const movementIds = command.received
          ? await receivePurchaseStock(tx, {
              access,
              actorUserId: actor.userId,
              lines,
              occurredAt,
              occurredLocalDate: command.occurredLocalDate,
              occurredLocalTime: command.occurredLocalTime,
              reason: stockReason(supplierRecord.name, record.invoiceNumber),
            })
          : lines.map(() => null);
        await tx.insert(purchaseLine).values(
          lines.map((line, index) => ({
            ...line,
            businessId: access.businessId,
            purchaseId: record.id,
            inventoryMovementId: movementIds[index] ?? null,
          })),
        );
        if (cashAccountId) {
          await appendPurchaseCashMovement(tx, {
            access,
            accountId: cashAccountId,
            actorUserId: actor.userId,
            amountMinorUnits: totalMinorUnits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            source: { purchaseId: record.id },
          });
        }
        const result = await currentPurchase(tx, access, record);
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId: record.supplierId,
          purchaseId: record.id,
          resultSnapshot: result,
        });
        return { purchase: result, replayed: false };
      });
    },

    async receivePurchase(actor, purchaseId, rawCommand) {
      const command = parseInput(
        receivePurchaseRequestSchema,
        rawCommand,
        "Purchase receipt confirmation is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "purchase.received";
      const commandFingerprint = await fingerprintCommand(action, { purchaseId, ...payload });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: purchaseOperationLog,
          permissions: ["purchases:manage", "inventory:manage"],
          snapshot: purchaseSchema,
        });
        if (replay) return { purchase: replay, replayed: true };

        const existing = await loadPurchase(tx, access, purchaseId, true);
        if (existing.status === "voided") {
          throw new ProductError("CONFLICT", "A voided purchase cannot be received");
        }
        if (existing.receivedAt !== null) {
          throw new ProductError("CONFLICT", "The purchase was already received");
        }
        const supplierName = (
          await loadSupplierNames(tx, access.businessId, [existing.supplierId])
        ).get(existing.supplierId);
        if (!supplierName) throw new Error("Purchase supplier is missing");
        const lines = (await loadLines(tx, access.businessId, [purchaseId])).get(purchaseId) ?? [];
        if (lines.length === 0) throw new Error("A stored purchase has no lines");
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const movementIds = await receivePurchaseStock(tx, {
          access,
          actorUserId: actor.userId,
          lines,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          reason: stockReason(supplierName, existing.invoiceNumber),
        });
        for (const [index, line] of lines.entries()) {
          const movementId = movementIds[index];
          if (!movementId) continue;
          await tx
            .update(purchaseLine)
            .set({ inventoryMovementId: movementId })
            .where(
              and(eq(purchaseLine.businessId, access.businessId), eq(purchaseLine.id, line.id)),
            );
        }
        const [record] = await tx
          .update(purchase)
          .set({ receivedAt: occurredAt })
          .where(and(eq(purchase.businessId, access.businessId), eq(purchase.id, purchaseId)))
          .returning();
        if (!record) throw new Error("Purchase receipt returned no record");
        const result = await currentPurchase(tx, access, record);
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId: record.supplierId,
          purchaseId,
          resultSnapshot: result,
        });
        return { purchase: result, replayed: false };
      });
    },

    async voidPurchase(actor, purchaseId, rawCommand) {
      const command = parseInput(
        voidPurchaseRequestSchema,
        rawCommand,
        "Purchase void confirmation is invalid",
      );
      const action = "purchase.voided";
      const commandFingerprint = await fingerprintCommand(action, {
        purchaseId,
        reason: command.reason,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: purchaseOperationLog,
          // A void can return stock and cash, so it needs every permission those take.
          permissions: ["purchases:manage", "inventory:manage", "cash:manage"],
          snapshot: purchaseSchema,
        });
        if (replay) return { purchase: replay, replayed: true };

        const existing: PurchaseRecord = await loadPurchase(tx, access, purchaseId, true);
        if (existing.status === "voided") {
          throw new ProductError("CONFLICT", "The purchase is already voided");
        }
        if ((await getSupplierPaymentsMinorUnits(tx, access.businessId, purchaseId)) !== 0n) {
          throw new ProductError("CONFLICT", "A purchase with supplier payments cannot be voided");
        }
        const now = await businessNow(tx, access);
        const lines = (await loadLines(tx, access.businessId, [purchaseId])).get(purchaseId) ?? [];
        await reversePurchaseStock(tx, {
          access,
          actorUserId: actor.userId,
          movementIds: lines.flatMap(({ inventoryMovementId }) =>
            inventoryMovementId ? [inventoryMovementId] : [],
          ),
          reason: command.reason,
          ...now,
        });
        if (existing.paymentTerms === "cash") {
          await reversePurchaseCashMovement(tx, {
            access,
            actorUserId: actor.userId,
            purchaseId,
            reason: command.reason,
            ...now,
          });
        }
        const [record] = await tx
          .update(purchase)
          .set({
            status: "voided",
            voidedAt: sql`transaction_timestamp()`,
            voidedByUserId: actor.userId,
            voidReason: command.reason,
          })
          .where(and(eq(purchase.businessId, access.businessId), eq(purchase.id, purchaseId)))
          .returning();
        if (!record) throw new Error("Purchase void returned no record");
        const result = await currentPurchase(tx, access, record);
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId: record.supplierId,
          purchaseId,
          resultSnapshot: result,
        });
        return { purchase: result, replayed: false };
      });
    },

    async createSupplierPayment(actor, purchaseId, rawCommand) {
      const command = parseInput(
        createSupplierPaymentRequestSchema,
        rawCommand,
        "Supplier payment confirmation is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "purchase.payment_applied";
      const commandFingerprint = await fingerprintCommand(action, { purchaseId, ...payload });
      const amountMinorUnits = BigInt(command.amountMinorUnits);
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: purchaseOperationLog,
          permissions: ["purchases:manage", "cash:manage"],
          snapshot: paymentResultSchema,
        });
        if (replay) return { ...replay, replayed: true };

        const existing = await loadPurchase(tx, access, purchaseId, true);
        if (existing.status === "voided") {
          throw new ProductError("CONFLICT", "A voided purchase cannot receive a payment");
        }
        const current = await currentPurchase(tx, access, existing);
        if (amountMinorUnits > BigInt(current.balanceMinorUnits)) {
          throw new ProductError("CONFLICT", "The payment exceeds the outstanding balance");
        }
        await requirePurchaseOutflowAccount(tx, access, command.accountId, amountMinorUnits);
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [record] = await tx
          .insert(supplierPayment)
          .values({
            businessId: access.businessId,
            purchaseId,
            supplierId: existing.supplierId,
            cashAccountId: command.accountId,
            amountMinorUnits,
            currency: existing.currency,
            currencyMinorUnitDigits: existing.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            reference: command.reference ?? null,
            entrySource: command.entrySource,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!record) throw new Error("Supplier payment insert returned no record");
        await appendPurchaseCashMovement(tx, {
          access,
          accountId: command.accountId,
          actorUserId: actor.userId,
          amountMinorUnits,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          source: { supplierPaymentId: record.id },
        });
        const result = {
          payment: toSupplierPayment(record),
          purchase: await currentPurchase(tx, access, existing),
        };
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId: existing.supplierId,
          purchaseId,
          paymentId: record.id,
          resultSnapshot: result,
        });
        return { ...result, replayed: false };
      });
    },
  };
}
