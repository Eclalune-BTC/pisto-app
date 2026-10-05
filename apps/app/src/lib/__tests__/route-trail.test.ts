import { describe, expect, test } from "vitest";

import { buildRouteTrail, hrefFor, queryOutsideRoute, routeFromSegments } from "@/lib/route-trail";

describe("route trail", () => {
  test("maps router segments to a known route pattern", () => {
    expect(routeFromSegments(["(app)", "operate", "sales", "[saleId]"])).toBe(
      "/operate/sales/[saleId]",
    );
    expect(routeFromSegments(["(app)", "operate"])).toBe("/operate");
    expect(routeFromSegments(["(app)", "billing", "success"])).toBe("/billing/success");
  });

  test("rejects routes that the shell does not model", () => {
    expect(routeFromSegments(["sign-in"])).toBeNull();
    expect(routeFromSegments(["(app)", "business"])).toBeNull();
    expect(routeFromSegments(["(app)", "operate", "unknown"])).toBeNull();
  });

  test("walks declared parents to the root and links every ancestor", () => {
    expect(
      buildRouteTrail("/operate/catalog/[productId]/edit", { productId: "product 1" }),
    ).toEqual([
      { route: "/operate", href: "/operate" },
      { route: "/operate/catalog", href: "/operate/catalog" },
      { route: "/operate/catalog/[productId]", href: "/operate/catalog/product%201" },
      { route: "/operate/catalog/[productId]/edit", href: null },
    ]);
  });

  test("resolves a parent parameter carried in the query string", () => {
    expect(buildRouteTrail("/operate/cash/adjustments/new", { accountId: "account-a" })).toEqual([
      { route: "/operate", href: "/operate" },
      { route: "/operate/cash", href: "/operate/cash" },
      { route: "/operate/cash/accounts/[accountId]", href: "/operate/cash/accounts/account-a" },
      { route: "/operate/cash/adjustments/new", href: null },
    ]);
  });

  test("leaves an ancestor unlinked instead of inventing a missing record", () => {
    expect(buildRouteTrail("/operate/cash/adjustments/new", {})[2]).toEqual({
      route: "/operate/cash/accounts/[accountId]",
      href: null,
    });
    expect(
      buildRouteTrail("/operate/cash/adjustments/new", { accountId: ["a", "b"] })[2]?.href,
    ).toBe(null);
  });

  test("returns sale corrections to the sale they correct", () => {
    expect(
      buildRouteTrail("/operate/sales/correct/[saleId]", { saleId: "sale-a" }).map(
        ({ href }) => href,
      ),
    ).toEqual(["/operate", "/operate/sales", "/operate/sales/sale-a", null]);
  });

  test("keeps account routes outside the business trail", () => {
    expect(buildRouteTrail("/settings", {})).toEqual([{ route: "/settings", href: null }]);
    expect(buildRouteTrail("/billing/success", {})).toEqual([
      { route: "/billing", href: "/billing" },
      { route: "/billing/success", href: null },
    ]);
  });
});

describe("route query memory", () => {
  test("keeps only the parameters that are not part of the route path", () => {
    expect(
      queryOutsideRoute("/operate/catalog/[productId]", {
        productId: "product-1",
        tab: "movements",
        status: ["active", "archived"],
      }),
    ).toBe("status=active&status=archived&tab=movements");
    expect(queryOutsideRoute("/operate/sales", {})).toBe("");
  });

  test("never lets a child record id into a list's remembered query", () => {
    expect(
      queryOutsideRoute("/operate/catalog", { productId: "product-1", q: "café", status: "all" }),
    ).toBe("q=caf%C3%A9&status=all");
    expect(
      queryOutsideRoute("/operate/receivables", {
        receivableId: "receivable-1",
        paymentId: "payment-1",
        state: "overdue",
      }),
    ).toBe("state=overdue");
  });

  test("rebuilds a route's own path only when every parameter is known", () => {
    expect(hrefFor("/operate/catalog/[productId]", { productId: "product 1" })).toBe(
      "/operate/catalog/product%201",
    );
    expect(hrefFor("/operate/catalog/[productId]", {})).toBeNull();
  });
});
