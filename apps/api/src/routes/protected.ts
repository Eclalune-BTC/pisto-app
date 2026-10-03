import { Elysia } from "elysia";
import { ApiError } from "../errors.ts";
import { requireRecordId } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";

type QueryPolicy = "first" | "last" | readonly string[];

function readQuery(request: Request, policy: QueryPolicy): Record<string, string> {
  const search = new URL(request.url).searchParams;
  if (typeof policy !== "string") {
    return Object.fromEntries(
      policy.flatMap((key) => {
        const value = search.get(key);
        return value === null ? [] : [[key, value]];
      }),
    );
  }
  if (policy === "last") return Object.fromEntries(search);
  const entries = new Map<string, string>();
  for (const [key, value] of search) {
    if (key && !entries.has(key)) entries.set(key, value);
  }
  return Object.fromEntries(entries);
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
      queryPolicy: (policy: QueryPolicy) => ({
        transform(context) {
          // Standard Schema's default parser coerces commas/JSON into arrays or
          // objects. Existing REST queries are scalar and have explicit duplicate rules.
          context.query = readQuery(context.request, policy);
        },
      }),
      record: (fields: Record<string, string>) => ({
        async parse({ params, request }) {
          // Malformed identifiers have always been hidden as 404, even before
          // parsing a malformed command body. GET/HEAD skip body parsing.
          validateRecordParams(params, fields);
          return request.json();
        },
        transform({ params }) {
          validateRecordParams(params, fields);
        },
      }),
    });
}
