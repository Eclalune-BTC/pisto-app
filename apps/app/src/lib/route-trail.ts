import {
  OPERATE_ROOT,
  OPERATE_ROUTE_PARENTS,
  type OperateRoute,
} from "@/features/operate/route-parents";

const ACCOUNT_ROUTE_PARENTS = {
  "/billing": null,
  "/billing/success": "/billing",
  "/settings": null,
} as const satisfies Readonly<Record<string, string | null>>;

export type AccountRoute = keyof typeof ACCOUNT_ROUTE_PARENTS;
export type ShellRoute = OperateRoute | AccountRoute;

export type RouteTrailEntry = {
  /** Null when the entry is the current page or a required route parameter is unknown. */
  href: string | null;
  route: ShellRoute;
};

const GROUP_SEGMENT = /^\(.+\)$/;
const PARAMETER = /\[([A-Za-z0-9]+)\]/g;

function isOperateRoute(route: string): route is OperateRoute {
  return route === OPERATE_ROOT || Object.hasOwn(OPERATE_ROUTE_PARENTS, route);
}

function isAccountRoute(route: string): route is AccountRoute {
  return Object.hasOwn(ACCOUNT_ROUTE_PARENTS, route);
}

/** Converts Expo Router segments such as `["(app)", "operate", "sales", "[saleId]"]` to a route pattern. */
export function routeFromSegments(segments: readonly string[]): ShellRoute | null {
  const route = `/${segments.filter((segment) => !GROUP_SEGMENT.test(segment)).join("/")}`;
  return isOperateRoute(route) || isAccountRoute(route) ? route : null;
}

function parentOf(route: ShellRoute): ShellRoute | null {
  if (route === OPERATE_ROOT) return null;
  if (isAccountRoute(route)) return ACCOUNT_ROUTE_PARENTS[route];
  return OPERATE_ROUTE_PARENTS[route as Exclude<OperateRoute, typeof OPERATE_ROOT>];
}

function hrefFor(route: ShellRoute, params: Readonly<Record<string, unknown>>): string | null {
  let complete = true;
  const href = route.replace(PARAMETER, (_, name: string) => {
    const value = params[name];
    if (typeof value !== "string" || value.length === 0) {
      complete = false;
      return "";
    }
    return encodeURIComponent(value);
  });
  return complete ? href : null;
}

/** The search parameters that are not part of the route's own path, as a stable query string. */
export function queryOutsideRoute(
  route: ShellRoute,
  params: Readonly<Record<string, unknown>>,
): string {
  const pathParameters = new Set([...route.matchAll(PARAMETER)].map(([, name]) => name));
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (pathParameters.has(key)) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "string") search.append(key, item);
    }
  }
  return search.toString();
}

/**
 * Builds the breadcrumb trail from the route the user is on up to its root, following the product's
 * declared parents. Parent links reuse the current route parameters; a parent whose parameter is not
 * known stays unlinked rather than pointing at an invented record.
 */
export function buildRouteTrail(
  route: ShellRoute,
  params: Readonly<Record<string, unknown>>,
): readonly RouteTrailEntry[] {
  const trail: RouteTrailEntry[] = [];
  for (let current: ShellRoute | null = route; current; current = parentOf(current)) {
    trail.unshift({ route: current, href: current === route ? null : hrefFor(current, params) });
  }
  return trail;
}
