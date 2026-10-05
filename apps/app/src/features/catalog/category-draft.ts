import type { CreateCategoryRequest, UpdateCategoryRequest } from "@pisto/contracts";
import { createCategoryRequestSchema, updateCategoryRequestSchema } from "@pisto/contracts";

export type CategoryDraftResult =
  | { error: "missing-name" | "name-too-long" }
  | { command: CreateCategoryRequest | UpdateCategoryRequest };

export function buildCategoryCommand(input: {
  idempotencyKey: string;
  mode: "create" | "edit";
  name: string;
}): CategoryDraftResult {
  const name = input.name.trim();
  if (!name) return { error: "missing-name" };
  if (name.length > 80) return { error: "name-too-long" };
  const candidate = { idempotencyKey: input.idempotencyKey, name };
  const parsed =
    input.mode === "create"
      ? createCategoryRequestSchema.safeParse(candidate)
      : updateCategoryRequestSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("A trimmed category name of 1 to 80 characters must parse");
  return { command: parsed.data };
}
