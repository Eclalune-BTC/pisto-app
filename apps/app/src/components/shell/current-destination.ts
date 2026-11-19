import { OPERATE_MODULES } from "@/features/operate/navigation";
import { routeLineage, type ShellRoute } from "@/lib/route-trail";

const MODULE_ROUTES = new Set<string>(OPERATE_MODULES.map(({ href }) => String(href)));

/**
 * The navigation destination a page belongs to: its module, or the root of its own trail when no
 * module is above it (Home for a page opened from Home, the account page for itself). The declared
 * parents decide, not the path: a purchase lives under `/operate/purchases` and belongs to
 * `/operate/payables`.
 */
export function currentDestination(route: ShellRoute | null): string | null {
  if (!route) return null;
  const lineage = routeLineage(route);
  return lineage.find((ancestor) => MODULE_ROUTES.has(ancestor)) ?? lineage[0] ?? null;
}
