/// <reference types="node" />
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { OPERATE_ROOT, OPERATE_ROUTE_PARENTS } from "@/features/operate/route-parents";
import { buildRouteTable, readRouteFiles } from "@/lib/route-table";

const ROUTE_TREE = fileURLToPath(new URL("../../app", import.meta.url));

const operateUrls = buildRouteTable(readRouteFiles(ROUTE_TREE)).urls.filter(
  (url) => url === OPERATE_ROOT || url.startsWith(`${OPERATE_ROOT}/`),
);

const entries = Object.entries(OPERATE_ROUTE_PARENTS);

function walkToRoot(route: string): readonly string[] {
  const path: string[] = [route];

  for (let step = route; step !== OPERATE_ROOT; ) {
    const parent = OPERATE_ROUTE_PARENTS[step as keyof typeof OPERATE_ROUTE_PARENTS];

    if (parent === undefined || path.includes(parent)) return [...path, parent ?? "<missing>"];

    path.push(parent);
    step = parent;
  }

  return path;
}

describe("operate route parents", () => {
  test("gives every operate route below the root a parent", () => {
    expect(Object.keys(OPERATE_ROUTE_PARENTS).sort()).toEqual(
      operateUrls.filter((url) => url !== OPERATE_ROOT),
    );
  });

  test("points every parent at a real operate route", () => {
    expect(entries.filter(([, parent]) => !operateUrls.includes(parent))).toEqual([]);
  });

  test("makes no route its own parent", () => {
    expect(entries.filter(([route, parent]) => route === parent)).toEqual([]);
  });

  test("reaches the operate root from every route without a cycle", () => {
    const unrooted = Object.keys(OPERATE_ROUTE_PARENTS).filter(
      (route) => walkToRoot(route).at(-1) !== OPERATE_ROOT,
    );

    expect(unrooted).toEqual([]);
  });

  test("keeps the root out of the map", () => {
    expect(OPERATE_ROUTE_PARENTS).not.toHaveProperty(OPERATE_ROOT);
  });
});
