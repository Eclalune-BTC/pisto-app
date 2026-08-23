import {
  archiveCategoryRequestSchema,
  categoryMutationResponseSchema,
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
} from "@pisto/contracts";
import { and, eq, ne, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError } from "../product.ts";
import { catalogCategory } from "../schema/catalog.ts";
import { authorizeCatalogAction } from "./access.ts";
import { fingerprint, parseMutationReplay, recordSnapshot, toCategory } from "./codec.ts";
import { lockOperation, lockSemanticKey, saveOperation } from "./operations.ts";
import type { CategoryCommands } from "./types.ts";

export function createCategoryCommands(db: Database): CategoryCommands {
  return {
    async createCategory(actor, inputCommand) {
      const parsed = createCategoryRequestSchema.safeParse(inputCommand);
      if (!parsed.success)
        throw new ProductError("VALIDATION_ERROR", "Category command is invalid");
      const command = parsed.data;
      const action = "category.created" as const;
      const commandFingerprint = await fingerprint(action, { name: command.name });
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:manage", "update");
        const replay = await lockOperation(
          transaction,
          actor,
          access.businessId,
          command.idempotencyKey,
          commandFingerprint,
        );
        if (replay) {
          return parseMutationReplay(categoryMutationResponseSchema.shape.data, replay);
        }
        await lockSemanticKey(transaction, "category-name", access.businessId, command.name);
        const [duplicate] = await transaction
          .select({ id: catalogCategory.id })
          .from(catalogCategory)
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              sql`lower(${catalogCategory.name}) = lower(${command.name})`,
            ),
          )
          .limit(1);
        if (duplicate)
          throw new ProductError("CONFLICT", "A category with that name already exists");
        const [created] = await transaction
          .insert(catalogCategory)
          .values({ businessId: access.businessId, name: command.name })
          .returning();
        if (!created) throw new Error("Category insert returned no record");
        const category = toCategory(created);
        await saveOperation(transaction, {
          action,
          actor,
          businessId: access.businessId,
          categoryId: category.id,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          resultSnapshot: recordSnapshot({ category }),
        });
        return { category, replayed: false };
      });
    },

    async updateCategory(actor, categoryId, inputCommand) {
      const parsed = updateCategoryRequestSchema.safeParse(inputCommand);
      if (!parsed.success)
        throw new ProductError("VALIDATION_ERROR", "Category command is invalid");
      const command = parsed.data;
      const action = "category.updated" as const;
      const commandFingerprint = await fingerprint(action, { categoryId, name: command.name });
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:manage", "update");
        const replay = await lockOperation(
          transaction,
          actor,
          access.businessId,
          command.idempotencyKey,
          commandFingerprint,
        );
        if (replay) return parseMutationReplay(categoryMutationResponseSchema.shape.data, replay);
        const [existing] = await transaction
          .select()
          .from(catalogCategory)
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              eq(catalogCategory.id, categoryId),
            ),
          )
          .limit(1)
          .for("update");
        if (!existing) throw new ProductError("NOT_FOUND", "Category was not found");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "An archived category cannot be updated");
        }
        await lockSemanticKey(transaction, "category-name", access.businessId, command.name);
        const [duplicate] = await transaction
          .select({ id: catalogCategory.id })
          .from(catalogCategory)
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              ne(catalogCategory.id, categoryId),
              sql`lower(${catalogCategory.name}) = lower(${command.name})`,
            ),
          )
          .limit(1);
        if (duplicate)
          throw new ProductError("CONFLICT", "A category with that name already exists");
        const [updated] = await transaction
          .update(catalogCategory)
          .set({ name: command.name, updatedAt: new Date() })
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              eq(catalogCategory.id, categoryId),
            ),
          )
          .returning();
        if (!updated) throw new Error("Category update returned no record");
        const category = toCategory(updated);
        await saveOperation(transaction, {
          action,
          actor,
          businessId: access.businessId,
          categoryId,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          resultSnapshot: recordSnapshot({ category }),
        });
        return { category, replayed: false };
      });
    },

    async archiveCategory(actor, categoryId, inputCommand) {
      const parsed = archiveCategoryRequestSchema.safeParse(inputCommand);
      if (!parsed.success)
        throw new ProductError("VALIDATION_ERROR", "Category command is invalid");
      const command = parsed.data;
      const action = "category.archived" as const;
      const commandFingerprint = await fingerprint(action, { categoryId });
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:manage", "update");
        const replay = await lockOperation(
          transaction,
          actor,
          access.businessId,
          command.idempotencyKey,
          commandFingerprint,
        );
        if (replay) return parseMutationReplay(categoryMutationResponseSchema.shape.data, replay);
        const [existing] = await transaction
          .select()
          .from(catalogCategory)
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              eq(catalogCategory.id, categoryId),
            ),
          )
          .limit(1)
          .for("update");
        if (!existing) throw new ProductError("NOT_FOUND", "Category was not found");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "The category is already archived");
        }
        const [updated] = await transaction
          .update(catalogCategory)
          .set({ status: "archived", updatedAt: new Date() })
          .where(
            and(
              eq(catalogCategory.businessId, access.businessId),
              eq(catalogCategory.id, categoryId),
            ),
          )
          .returning();
        if (!updated) throw new Error("Category archive returned no record");
        const category = toCategory(updated);
        await saveOperation(transaction, {
          action,
          actor,
          businessId: access.businessId,
          categoryId,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          resultSnapshot: recordSnapshot({ category }),
        });
        return { category, replayed: false };
      });
    },
  };
}
