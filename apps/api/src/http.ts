import { status } from "elysia";
import { z } from "zod";

import { ApiError } from "./errors.ts";

/**
 * Standard Schema adapter for Elysia route validation. Invalid fields return 400
 * VALIDATION_ERROR with flattened contract details, never Elysia's submitted-value diagnostics.
 */
export function contract<Schema extends z.ZodType>(schema: Schema, message: string) {
  return {
    "~standard": {
      ...schema["~standard"],
      validate(value: unknown) {
        const parsed = schema.safeParse(value);
        if (!parsed.success) {
          throw new ApiError(400, "VALIDATION_ERROR", message, parsed.error.flatten());
        }
        return { value: parsed.data as z.output<Schema> };
      },
    },
  };
}

const recordIdSchema = z.string().uuid();

/** Malformed identifiers receive the same 404 response as undisclosed records. */
export function requireRecordId(value: string, notFoundMessage: string): string {
  const parsed = recordIdSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", notFoundMessage);
  return parsed.data;
}

/** An exact idempotent replay is not a new resource, so it answers 200, not 201. */
export function commandResponse<T extends { replayed: boolean }>(data: T) {
  return status(data.replayed ? 200 : 201, { data });
}
