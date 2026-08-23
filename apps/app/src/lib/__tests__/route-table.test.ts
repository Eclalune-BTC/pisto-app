/// <reference types="node" />
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { buildRouteTable, readRouteFiles } from "@/lib/route-table";

const ROUTE_TREE = fileURLToPath(new URL("../../app", import.meta.url));

describe("route table", () => {
  const files = readRouteFiles(ROUTE_TREE);
  const table = buildRouteTable(files);

  test("maps the route tree to exactly these URLs", () => {
    expect(table.urls).toEqual([
      "/",
      "/billing",
      "/billing/success",
      "/business",
      "/dashboard",
      "/operate",
      "/operate/cash",
      "/operate/cash/accounts/[accountId]",
      "/operate/cash/accounts/[accountId]/edit",
      "/operate/cash/accounts/new",
      "/operate/cash/adjustments/new",
      "/operate/cash/transfers/new",
      "/operate/catalog",
      "/operate/catalog/[productId]",
      "/operate/catalog/[productId]/edit",
      "/operate/catalog/categories",
      "/operate/catalog/new",
      "/operate/customers",
      "/operate/customers/[customerId]",
      "/operate/customers/[customerId]/archive",
      "/operate/customers/[customerId]/edit",
      "/operate/customers/new",
      "/operate/expenses",
      "/operate/expenses/[expenseId]",
      "/operate/expenses/new",
      "/operate/inventory",
      "/operate/inventory/[productId]",
      "/operate/inventory/[productId]/new",
      "/operate/inventory/[productId]/reverse/[movementId]",
      "/operate/receivables",
      "/operate/receivables/[receivableId]",
      "/operate/receivables/[receivableId]/payment",
      "/operate/receivables/[receivableId]/payments/[paymentId]/reverse",
      "/operate/receivables/[receivableId]/void",
      "/operate/receivables/new",
      "/operate/reports",
      "/operate/sales",
      "/operate/sales/[saleId]",
      "/operate/sales/correct/[saleId]",
      "/operate/sales/new",
      "/settings",
      "/sign-in",
      "/sign-up",
    ]);
  });

  test("keeps exactly these layouts and special files", () => {
    expect(table.layouts).toEqual(["(app)/_layout.tsx", "_layout.tsx"]);
    expect(table.specials).toEqual(["+html.tsx", "+not-found.tsx"]);
  });

  test("gives every URL a single owning file", () => {
    expect(table.conflicts).toEqual([]);
  });

  test("holds no file the mapper cannot classify", () => {
    expect(files.every((file) => file.endsWith(".tsx"))).toBe(true);
  });
});

describe("route table conventions", () => {
  test("drops group directories from the URL", () => {
    expect(buildRouteTable(["(app)/(shell)/dashboard.tsx"]).urls).toEqual(["/dashboard"]);
  });

  test("maps an index file to its directory", () => {
    expect(buildRouteTable(["index.tsx", "(app)/billing/index.tsx"]).urls).toEqual([
      "/",
      "/billing",
    ]);
  });

  test("keeps a dynamic segment as written", () => {
    expect(buildRouteTable(["sales/[saleId]/edit.tsx"]).urls).toEqual(["/sales/[saleId]/edit"]);
  });

  test("excludes layouts and special files from the URL set", () => {
    const table = buildRouteTable(["_layout.tsx", "+html.tsx", "+not-found.tsx", "index.tsx"]);

    expect(table.urls).toEqual(["/"]);
    expect(table.layouts).toEqual(["_layout.tsx"]);
    expect(table.specials).toEqual(["+html.tsx", "+not-found.tsx"]);
  });

  test("reports a URL two groups both claim", () => {
    expect(buildRouteTable(["(app)/settings.tsx", "(public)/settings.tsx"]).conflicts).toEqual([
      { files: ["(app)/settings.tsx", "(public)/settings.tsx"], url: "/settings" },
    ]);
  });

  test("refuses a convention it does not model", () => {
    expect(() => buildRouteTable(["helper.ts"])).toThrow(/does not end in/);
    expect(() => buildRouteTable(["settings.web.tsx"])).toThrow(/unmodelled file name/);
    expect(() => buildRouteTable(["[...slug].tsx"])).toThrow(/unmodelled file name/);
    expect(() => buildRouteTable(["reports+api.tsx"])).toThrow(/unmodelled file name/);
    expect(() => buildRouteTable(["+native-intent.tsx"])).toThrow(/unmodelled special file/);
    expect(() => buildRouteTable(["(app,public)/settings.tsx"])).toThrow(
      /unmodelled directory segment/,
    );
  });
});
