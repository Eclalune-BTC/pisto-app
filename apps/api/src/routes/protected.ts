import { Elysia } from "elysia";
import type { z } from "zod";
import { ApiError } from "../errors.ts";
import { contract, requireRecordId } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";

/**
 * Declares a list query from its Zod object contract. Only the contract's own keys are read, so
 * unrelated parameters (tracking tags, a client-chosen tenant) are ignored. A repeated contract key
 * is rejected: picking one occurrence would let a proxy and this API read different values.
 * Values stay scalar strings; Elysia's default parser would coerce commas/JSON into arrays/objects.
 */
export function queryContract<Schema extends z.ZodObject>(schema: Schema, message: string) {
  const keys = Object.keys(schema.shape);
  return {
    query: contract(schema, message),
    transform(context: { request: Request; query: unknown }) {
      const search = new URL(context.request.url).searchParams;
      const query: Record<string, string> = {};
      const duplicated: Record<string, string[]> = {};
      for (const key of keys) {
        const values = search.getAll(key);
        if (values.length > 1) duplicated[key] = ["Provide this query parameter only once"];
        if (values[0] !== undefined) query[key] = values[0];
      }
      if (Object.keys(duplicated).length > 0) {
        throw new ApiError(400, "VALIDATION_ERROR", message, {
          formErrors: [],
          fieldErrors: duplicated,
        });
      }
      context.query = query;
    },
  };
}

function validateRecordParams(params: Record<string, string>, fields: Record<string, string>) {
  for (const [key, message] of Object.entries(fields)) requireRecordId(params[key] ?? "", message);
}

/** Shared HTTP policies for business routes, with no domain or permission inference. */
export function protectedRoutes(access: ProductAccess) {
  return new Elysia({ prefix: "/v1", strictPath: true })
    .use(access)
    .resolve(({ actor }) => {
      if (!actor) throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
      return { actor };
    })
    .macro({
      // Malformed identifiers are hidden as 404 before a malformed command body is parsed.
      record: (fields: Record<string, string>) => ({
        parse({ params, request }) {
          validateRecordParams(params, fields);
          return request.json();
        },
        transform({ params, request }) {
          // Elysia runs parse hooks for every method except GET and HEAD, so only those
          // requests still need the identifier check here.
          if (request.method === "GET" || request.method === "HEAD") {
            validateRecordParams(params, fields);
          }
        },
      }),
    });
}
