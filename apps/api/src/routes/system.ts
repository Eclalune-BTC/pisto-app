import type { BillingRuntime } from "@pisto/billing";
import type { DatabaseHandle } from "@pisto/db";
import { Hono } from "hono";

import type { AppEnv } from "../types.ts";

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
  const routes = new Hono<AppEnv>();

  routes.get("/health", (context) =>
    context.json({
      status: "ok" as const,
      service: "pisto-api" as const,
      timestamp: new Date().toISOString(),
    }),
  );

  routes.get("/ready", async (context) => {
    let database: "ok" | "error" = "ok";
    try {
      await withTimeout(input.database.ping(), 2_000);
    } catch {
      database = "error";
    }
    const response = {
      status: database === "ok" ? ("ready" as const) : ("not_ready" as const),
      service: "pisto-api" as const,
      timestamp: new Date().toISOString(),
      checks: {
        database,
        billing:
          input.billing.config.polar.enabled || input.billing.config.revenueCat.enabled
            ? ("enabled" as const)
            : ("disabled" as const),
      },
    };
    return context.json(response, database === "ok" ? 200 : 503);
  });

  return routes;
}
