import type {
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "../../../../../packages/contracts/src/catalog";
import {
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
} from "../../../../../packages/contracts/src/catalog";

export type CategoryDraftResult =
  | { error: "invalid-name" }
  | { command: CreateCategoryRequest | UpdateCategoryRequest };

export function buildCategoryCommand(input: {
  idempotencyKey: string;
  mode: "create" | "edit";
  name: string;
}): CategoryDraftResult {
  const name = input.name.trim();
  if (!name || name.length > 80) return { error: "invalid-name" };
  const candidate = { idempotencyKey: input.idempotencyKey, name };
  const parsed =
    input.mode === "create"
      ? createCategoryRequestSchema.safeParse(candidate)
      : updateCategoryRequestSchema.safeParse(candidate);
  return parsed.success ? { command: parsed.data } : { error: "invalid-name" };
}
