import {
  archiveCategoryRequestSchema,
  categoryMutationResponseSchema,
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
} from "@pisto/contracts";
import { and, eq, ne, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import {
  beginOperation,
  fingerprintCommand,
  lockSemanticKey,
  saveOperation,
} from "../operation-log.ts";
import { catalogCategory } from "../schema/catalog.ts";
import { toCategory } from "./mappers.ts";
import { catalogOperationLog } from "./records.ts";
import type { CategoryCommands } from "./types.ts";

const categorySnapshotSchema = categoryMutationResponseSchema.shape.data.omit({ replayed: true });

async function lockExistingCategory(tx: DatabaseTransaction, businessId: string, id: string) {
  const [existing] = await tx
    .select()
    .from(catalogCategory)
    .where(and(eq(catalogCategory.businessId, businessId), eq(catalogCategory.id, id)))
    .limit(1)
    .for("update");
  if (!existing) throw new ProductError("NOT_FOUND", "Category was not found");
  return existing;
}

async function requireUniqueName(
  tx: DatabaseTransaction,
  businessId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  await lockSemanticKey(tx, "category-name", businessId, name);
  const [duplicate] = await tx
    .select({ id: catalogCategory.id })
    .from(catalogCategory)
    .where(
      and(
        eq(catalogCategory.businessId, businessId),
        exceptId === undefined ? undefined : ne(catalogCategory.id, exceptId),
        sql`lower(${catalogCategory.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (duplicate) throw new ProductError("CONFLICT", "A category with that name already exists");
}

export function createCategoryCommands(db: Database): CategoryCommands {
  return {
    async createCategory(actor, rawCommand) {
      const command = parseInput(
        createCategoryRequestSchema,
        rawCommand,
        "Category command is invalid",
      );
      const action = "category.created";
      const commandFingerprint = await fingerprintCommand(action, { name: command.name });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["catalog:manage"],
          snapshot: categorySnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        await requireUniqueName(tx, access.businessId, command.name);
        const [created] = await tx
          .insert(catalogCategory)
          .values({ businessId: access.businessId, name: command.name })
          .returning();
        if (!created) throw new Error("Category insert returned no record");
        const category = toCategory(created);
        await saveOperation(tx, catalogOperationLog, identity, {
          categoryId: category.id,
          resultSnapshot: { category },
        });
        return { category, replayed: false };
      });
    },

    async updateCategory(actor, categoryId, rawCommand) {
      const command = parseInput(
        updateCategoryRequestSchema,
        rawCommand,
        "Category command is invalid",
      );
      const action = "category.updated";
      const commandFingerprint = await fingerprintCommand(action, {
        categoryId,
        name: command.name,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["catalog:manage"],
          snapshot: categorySnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const existing = await lockExistingCategory(tx, access.businessId, categoryId);
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "An archived category cannot be updated");
        }
        await requireUniqueName(tx, access.businessId, command.name, categoryId);
        const [updated] = await tx
          .update(catalogCategory)
          .set({ name: command.name, updatedAt: access.queriedAt })
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              eq(catalogCategory.id, categoryId),
            ),
          )
          .returning();
        if (!updated) throw new Error("Category update returned no record");
        const category = toCategory(updated);
        await saveOperation(tx, catalogOperationLog, identity, {
          categoryId,
          resultSnapshot: { category },
        });
        return { category, replayed: false };
      });
    },

    async archiveCategory(actor, categoryId, rawCommand) {
      const command = parseInput(
        archiveCategoryRequestSchema,
        rawCommand,
        "Category command is invalid",
      );
      const action = "category.archived";
      const commandFingerprint = await fingerprintCommand(action, { categoryId });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["catalog:manage"],
          snapshot: categorySnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const existing = await lockExistingCategory(tx, access.businessId, categoryId);
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "The category is already archived");
        }
        const [updated] = await tx
          .update(catalogCategory)
          .set({ status: "archived", updatedAt: access.queriedAt })
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              eq(catalogCategory.id, categoryId),
            ),
          )
          .returning();
        if (!updated) throw new Error("Category archive returned no record");
        const category = toCategory(updated);
        await saveOperation(tx, catalogOperationLog, identity, {
          categoryId,
          resultSnapshot: { category },
        });
        return { category, replayed: false };
      });
    },
  };
}
