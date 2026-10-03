import type { Auth } from "@pisto/auth";
import { Elysia } from "elysia";
import { normalizeError } from "../src/errors.ts";
import { productAccess } from "../src/middleware/product-access.ts";

export function testClient(
  app: { handle: (request: Request) => Response | Promise<Response> },
  prefix = "",
) {
  return {
    request: (path: string | Request, init?: RequestInit) =>
      Promise.resolve(
        app.handle(
          path instanceof Request
            ? path
            : new Request(new URL(`${prefix}${path}`, "http://localhost"), init),
        ),
      ),
  };
}

export function testAccess(auth: Auth) {
  return productAccess({
    auth,
    writesEnabled: true,
    consume: async () => ({ allowed: true, retryAfterSeconds: 60 }),
  });
}

export function testErrorBoundary(requestId = "request_test") {
  return new Elysia({ strictPath: true }).onError(({ error, set }) => {
    const { apiError } = normalizeError(error);
    set.status = apiError.status;
    return {
      error: {
        code: apiError.code,
        message: apiError.message,
        requestId,
        ...(apiError.details !== undefined ? { details: apiError.details } : {}),
      },
    };
  });
}
