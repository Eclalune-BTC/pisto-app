import { Elysia } from "elysia";
import type { z } from "zod";
import { ApiError } from "../errors.ts";
import { contract, requireRecordId } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";

/**
 * Declares a list query from its strict Zod object contract. Every parameter is read, so an unknown
 * key (a typo or a client-chosen tenant) fails validation instead of being silently dropped. A
 * repeated key is rejected: picking one occurrence would let a proxy and this API read different
 * values. Values stay scalar strings; Elysia's default parser would coerce commas/JSON into
 * arrays/objects.
 */
export function queryContract<Schema extends z.ZodObject>(schema: Schema, message: string) {
  if (schema.def.catchall?._zod.def.type !== "never") {
    throw new Error(`${message}: the query contract must be a strict object`);
  }
  return {
    query: contract(schema, message),
    transform(context: { request: Request; query: unknown }) {
      const query: Record<string, string> = {};
      const duplicated: Record<string, string[]> = {};
      for (const [key, value] of new URL(context.request.url).searchParams) {
        // Zod's strict check deliberately skips `__proto__`, so it is rejected here.
        if (key === "__proto__") {
          throw new ApiError(400, "VALIDATION_ERROR", message, {
            formErrors: ['Unrecognized key: "__proto__"'],
            fieldErrors: {},
          });
        }
        if (Object.hasOwn(query, key)) duplicated[key] = ["Provide this query parameter only once"];
        else query[key] = value;
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
  for (const [key, message] of Object.entries(fields)) {
    const value = params[key];
    // Elysia reports any `parse` failure as a malformed body, so a misdeclared field is left to
    // `transform`, where it surfaces as an unexpected error instead of a client error.
    if (value !== undefined) requireRecordId(value, message);
  }
}

function requireDeclaredParams(params: Record<string, string>, fields: Record<string, string>) {
  for (const key of Object.keys(fields)) {
    if (params[key] === undefined) {
      throw new Error(`Record field "${key}" is not a route parameter`);
    }
  }
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
          requireDeclaredParams(params, fields);
          // Elysia runs parse hooks for every method except GET and HEAD, so only those
          // requests still need the identifier check here.
          if (request.method === "GET" || request.method === "HEAD") {
            validateRecordParams(params, fields);
          }
        },
      }),
    });
}
