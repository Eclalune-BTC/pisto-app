import type { BillingRuntime } from "@pisto/billing";
import type { DatabaseHandle } from "@pisto/db";
import { Elysia } from "elysia";

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Readiness check timed out")), milliseconds);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function systemRoutes(input: { database: DatabaseHandle; billing: BillingRuntime }) {
  const routes = new Elysia({ strictPath: true });

  routes.get("/health", () => ({
    status: "ok" as const,
    service: "pisto-api" as const,
    timestamp: new Date().toISOString(),
  }));

  routes.get("/ready", async (context) => {
    let database: "ok" | "error" = "ok";
    try {
      await withTimeout(input.database.ping(), 2_000);
    } catch (error) {
      database = "error";
      // Driver messages can carry connection details, so only the failure type is logged.
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "Readiness database check failed",
          errorType: error instanceof Error ? error.name : typeof error,
        }),
      );
    }
    const response = {
      status: database === "ok" ? ("ready" as const) : ("not_ready" as const),
      service: "pisto-api" as const,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        billing:
          input.billing.checkoutEnabled || input.billing.revenueCatEnabled
            ? ("enabled" as const)
            : ("disabled" as const),
      },
    };
    context.set.status = database === "ok" ? 200 : 503;
    return response;
  });

  return routes;
}
