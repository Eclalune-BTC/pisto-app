#!/usr/bin/env bun

import {
  apiErrorEnvelopeSchema,
  billingCatalogResponseSchema,
  businessesResponseSchema,
  createBusinessResponseSchema,
  healthResponseSchema,
  meResponseSchema,
  operatingReportResponseSchema,
  productListResponseSchema,
  readinessResponseSchema,
  saleCorrectionResponseSchema,
  saleListResponseSchema,
  saleResponseSchema,
} from "../packages/contracts/src/index";

class SmokeFailure extends Error {}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SmokeFailure(message);
}

export function loopbackHttpOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SmokeFailure("Smoke URLs must be absolute loopback HTTP origins");
  }
  invariant(
    url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "Smoke URLs must be loopback HTTP origins without credentials, paths, queries, or fragments",
  );
  return url.origin;
}

export function localSmokeConfig(env: Record<string, string | undefined>) {
  return {
    apiOrigin: loopbackHttpOrigin(
      env.SMOKE_API_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3001",
    ),
    webOrigin: loopbackHttpOrigin(env.SMOKE_WEB_ORIGIN ?? "http://localhost:8081"),
  };
}

export function rejectSmokeProxy(env: Record<string, string | undefined>) {
  invariant(
    !Object.keys(env).some((name) => /^(?:https?|all)_proxy$/i.test(name) && env[name]?.trim()),
    "Clear proxy environment variables before running the local smoke test",
  );
}

export function hasHttpOnlySessionCookie(values: readonly string[]): boolean {
  return values.some(
    (value) =>
      /^(?:__Secure-|__Host-)?pisto\.session_token=/.test(value) &&
      /;\s*httponly(?:;|$)/i.test(value),
  );
}

function parse<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  invariant(parsed.success, "Response does not match the public contract");
  return parsed.data;
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  status?: number | readonly number[];
  cookie?: string;
};

export async function runLocalSmoke(env: Record<string, string | undefined> = process.env) {
  const checks: { step: string; method: string; status: number; milliseconds: number }[] = [];
  let stage = "validate local configuration";
  let apiOrigin: string | undefined;
  let businessId: string | undefined;
  let saleId: string | undefined;
  let saleCreationAttempted = false;
  let saleVoided = false;
  let signedOut = false;
  let failure: string | undefined;
  const cookies = new Map<string, string>();

  try {
    const config = localSmokeConfig(env);
    // Standard fetch can honor ambient proxies even when the URL is loopback.
    rejectSmokeProxy(process.env);
    rejectSmokeProxy(env);
    apiOrigin = config.apiOrigin;
    const cookieHeader = () => [...cookies.values()].join("; ");
    const voidCommand = {
      idempotencyKey: crypto.randomUUID(),
      reason: "QA LOCAL ONLY: void synthetic smoke-test sale; no real transaction",
    };

    async function request(step: string, path: string, options: RequestOptions = {}) {
      stage = step;
      const url = new URL(path, config.apiOrigin);
      invariant(url.origin === config.apiOrigin, "Request must remain on the local API origin");
      const started = performance.now();
      const headers = new Headers({ Accept: "application/json", Origin: config.webOrigin });
      const cookie = options.cookie ?? cookieHeader();
      if (cookie) headers.set("Cookie", cookie);
      if (options.body !== undefined) headers.set("Content-Type", "application/json");

      let response: Response;
      try {
        response = await fetch(url, {
          method: options.method ?? "GET",
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          redirect: "manual",
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new SmokeFailure("Local API request failed or exceeded 15 seconds");
      }
      checks.push({
        step,
        method: options.method ?? "GET",
        status: response.status,
        milliseconds: Math.round(performance.now() - started),
      });
      const accepted = options.status ?? 200;
      invariant(
        typeof accepted === "number"
          ? response.status === accepted
          : accepted.includes(response.status),
        `Unexpected HTTP status ${response.status}; redirects are never followed`,
      );
      if (path.startsWith("/v1")) {
        invariant(
          response.headers
            .get("cache-control")
            ?.split(/\s*,\s*/)
            .includes("no-store"),
          "Sensitive API response must set Cache-Control: no-store",
        );
      }
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(";", 1)[0];
        if (!pair) continue;
        const separator = pair.indexOf("=");
        if (separator < 1) continue;
        const name = pair.slice(0, separator);
        if (!pair.slice(separator + 1) || /;\s*max-age=0(?:;|$)/i.test(value)) cookies.delete(name);
        else cookies.set(name, pair);
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new SmokeFailure("Local API response must contain JSON");
      }
      return { data, response };
    }

    const voidSyntheticSale = async (step: string) => {
      invariant(saleId, "Synthetic sale identifier is missing");
      const result = parse(
        saleCorrectionResponseSchema,
        (
          await request(step, `/v1/sales/${encodeURIComponent(saleId)}/void`, {
            method: "POST",
            status: [200, 201],
            body: voidCommand,
          })
        ).data,
      );
      invariant(
        result.data.originalSale.id === saleId && result.data.originalSale.status === "voided",
        "Void must preserve the original sale and mark it voided",
      );
      saleVoided = true;
    };

    try {
      parse(healthResponseSchema, (await request("health", "/health")).data);
      const readiness = parse(readinessResponseSchema, (await request("readiness", "/ready")).data);
      invariant(readiness.status === "ready", "Local database must be ready");
      const anonymous = await request("anonymous access denied", "/v1/me", { status: 401 });
      invariant(
        parse(apiErrorEnvelopeSchema, anonymous.data).error.code === "UNAUTHORIZED",
        "Anonymous account access must be unauthorized",
      );

      const runId = crypto.randomUUID();
      const signup = await request("create QA owner", "/api/auth/sign-up/email", {
        method: "POST",
        body: {
          name: "QA LOCAL ONLY smoke-test owner",
          email: `pisto-qa-local-${runId}@example.test`,
          password: crypto.randomUUID() + crypto.randomUUID(),
        },
      });
      invariant(cookies.size > 0, "Sign-up must establish an authenticated session");
      invariant(
        hasHttpOnlySessionCookie(signup.response.headers.getSetCookie()),
        "Session cookie must be HttpOnly",
      );
      const initialSession = parse(meResponseSchema, (await request("QA session", "/v1/me")).data);
      invariant(
        initialSession.data.session.activeOrganizationId === null,
        "New QA owner must be isolated",
      );
      const originalCookie = cookieHeader();
      const business = parse(
        createBusinessResponseSchema,
        (
          await request("create isolated QA business", "/v1/businesses", {
            method: "POST",
            status: 201,
            body: {
              name: `QA LOCAL ONLY ${runId}`,
              currency: "USD",
              timeZone: "America/El_Salvador",
            },
          })
        ).data,
      ).data.business;
      businessId = business.id;
      invariant(business.access.role === "owner", "QA business creator must have owner access");
      const freshSession = parse(
        meResponseSchema,
        (
          await request("fresh session after business selection", "/v1/me", {
            cookie: originalCookie,
          })
        ).data,
      );
      invariant(
        freshSession.data.session.activeOrganizationId === businessId &&
          freshSession.data.user.id === initialSession.data.user.id,
        "Existing session cookie must observe freshly selected business state",
      );
      const businesses = parse(
        businessesResponseSchema,
        (await request("QA business isolation", "/v1/businesses")).data,
      );
      invariant(
        businesses.data.items.length === 1 && businesses.data.items[0]?.id === businessId,
        "QA owner must see only its new business",
      );
      const catalog = parse(
        productListResponseSchema,
        (await request("strict catalog query", "/v1/catalog/products?search=QA&limit=5")).data,
      );
      invariant(catalog.data.items.length === 0, "New QA business must have an empty catalog");
      const invalidQuery = await request(
        "reject unknown catalog query",
        "/v1/catalog/products?path=unexpected",
        { status: 400 },
      );
      invariant(
        parse(apiErrorEnvelopeSchema, invalidQuery.data).error.code === "VALIDATION_ERROR",
        "Unknown catalog query keys must be rejected",
      );

      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/El_Salvador",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const command = {
        idempotencyKey: crypto.randomUUID(),
        grossMinorUnits: "1250",
        occurredLocalDate: localDate,
        occurredLocalTime: "00:00",
        description: "QA LOCAL ONLY: synthetic smoke-test sale; no real transaction",
      };
      saleCreationAttempted = true;
      const created = parse(
        saleResponseSchema,
        (
          await request("create synthetic USD sale", "/v1/sales", {
            method: "POST",
            status: 201,
            body: command,
          })
        ).data,
      );
      saleId = created.data.sale.id;
      invariant(
        created.data.sale.grossMinorUnits === "1250" &&
          created.data.sale.currency === "USD" &&
          !created.data.replayed,
        "Sale must preserve the exact confirmed amount and currency",
      );
      const replay = parse(
        saleResponseSchema,
        (await request("exact sale replay", "/v1/sales", { method: "POST", body: command })).data,
      );
      invariant(
        replay.data.replayed && replay.data.sale.id === saleId,
        "Exact replay must return the same sale",
      );
      const conflict = await request("reject changed idempotency payload", "/v1/sales", {
        method: "POST",
        status: 409,
        body: { ...command, grossMinorUnits: "1251" },
      });
      invariant(
        parse(apiErrorEnvelopeSchema, conflict.data).error.code === "IDEMPOTENCY_CONFLICT",
        "Changed replay must fail without another sale",
      );
      const salePath = `/v1/sales/${encodeURIComponent(saleId)}`;
      const detail = parse(
        saleResponseSchema,
        (await request("read synthetic sale", salePath)).data,
      );
      invariant(
        detail.data.sale.id === saleId && detail.data.sale.status === "posted",
        "Saved sale must be readable and posted",
      );
      const history = parse(
        saleListResponseSchema,
        (await request("history contains one sale", "/v1/sales?limit=5")).data,
      );
      invariant(
        history.data.items.length === 1 && history.data.items[0]?.id === saleId,
        "Replay must not duplicate sale history",
      );
      const reportPath = `/v1/reports/operating?startLocalDate=${localDate}&endLocalDate=${localDate}`;
      const report = parse(
        operatingReportResponseSchema,
        (await request("report includes exact sale", reportPath)).data,
      ).data.report;
      invariant(
        report.currency === "USD" &&
          report.sales.grossMinorUnits === "1250" &&
          report.sales.saleCount === "1",
        "Report must count the synthetic sale exactly once",
      );
      await voidSyntheticSale("void synthetic sale");
      const voided = parse(saleResponseSchema, (await request("read voided sale", salePath)).data)
        .data.sale;
      invariant(
        voided.status === "voided" && voided.correction?.kind === "void",
        "Voided sale must retain its correction history",
      );
      const afterVoid = parse(
        operatingReportResponseSchema,
        (await request("report excludes voided sale", reportPath)).data,
      ).data.report;
      invariant(
        afterVoid.sales.grossMinorUnits === "0" && afterVoid.sales.saleCount === "0",
        "Voided sale must no longer contribute to report totals",
      );
      const retained = parse(
        saleListResponseSchema,
        (await request("void retains sale history", "/v1/sales?status=voided&limit=5")).data,
      );
      invariant(
        retained.data.items.length === 1 && retained.data.items[0]?.id === saleId,
        "Void must retain the original record in history",
      );
      const billing = parse(
        billingCatalogResponseSchema,
        (await request("billing remains disabled", "/v1/billing/catalog")).data,
      );
      invariant(
        billing.data.status === "disabled",
        "Local smoke expects billing to remain disabled",
      );

      const revokedCookie = cookieHeader();
      await request("sign out QA owner", "/api/auth/sign-out", { method: "POST", body: {} });
      signedOut = true;
      const revoked = await request("revoked cookie denied", "/v1/me", {
        status: 401,
        cookie: revokedCookie,
      });
      invariant(
        parse(apiErrorEnvelopeSchema, revoked.data).error.code === "UNAUTHORIZED",
        "Signed-out session must fail even with its former cookie",
      );
    } catch (error) {
      failure = `${stage}: ${error instanceof SmokeFailure ? error.message : "Unexpected verification failure"}`;
    } finally {
      if (saleCreationAttempted && !saleId) {
        failure = `${failure ?? "Verification failed"}; sale outcome is unconfirmed because no sale identifier was received`;
      }
      if (saleId && !saleVoided && cookies.size) {
        try {
          await voidSyntheticSale("cleanup synthetic sale");
        } catch {
          failure = `${failure ?? "Verification failed"}; synthetic sale cleanup could not be confirmed`;
        }
      }
      if (!signedOut && cookies.size) {
        try {
          await request("cleanup QA session", "/api/auth/sign-out", { method: "POST", body: {} });
          signedOut = true;
        } catch {
          failure = `${failure ?? "Verification failed"}; session cleanup could not be confirmed`;
        }
      }
      cookies.clear();
    }
  } catch (error) {
    failure = error instanceof SmokeFailure ? error.message : "Local smoke initialization failed";
  }

  return {
    passed: !failure,
    testedAt: new Date().toISOString(),
    apiOrigin,
    businessId,
    saleId,
    saleVoided,
    saleOutcome: saleVoided
      ? "voided"
      : saleId
        ? "not_confirmed_voided"
        : saleCreationAttempted
          ? "unconfirmed"
          : "not_created",
    signedOut,
    requests: checks.length,
    checks,
    ...(failure ? { failure } : {}),
    note: "Any created QA account and business remain local; the synthetic sale is voided on success. No credentials or cookies are recorded.",
  };
}

if (import.meta.main) {
  const result = await runLocalSmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
