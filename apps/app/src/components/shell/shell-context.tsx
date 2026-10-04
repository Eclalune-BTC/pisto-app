import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ShellRoute } from "@/lib/route-trail";

export const TOP_BAR_HEIGHT = 48;

type RouteLabels = Readonly<Partial<Record<ShellRoute, string>>>;

type ShellContextValue = {
  /** Path and query last visited for a route, so a breadcrumb returns to the same filtered list. */
  lastVisit: (route: ShellRoute, path: string) => string | undefined;
  rememberVisit: (route: ShellRoute, path: string, query: string) => void;
  routeLabels: RouteLabels;
  setRouteLabel: (route: ShellRoute, label: string | undefined) => void;
  topInset: number;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: PropsWithChildren) {
  const [routeLabels, setRouteLabels] = useState<RouteLabels>({});
  const setRouteLabel = useCallback((route: ShellRoute, label: string | undefined) => {
    setRouteLabels((current) => {
      if (current[route] === label) return current;
      const next = { ...current };
      if (label === undefined) delete next[route];
      else next[route] = label;
      return next;
    });
  }, []);
  const visits = useRef(new Map<ShellRoute, { path: string; query: string }>());
  const rememberVisit = useCallback((route: ShellRoute, path: string, query: string) => {
    visits.current.set(route, { path, query });
  }, []);
  const lastVisit = useCallback((route: ShellRoute, path: string) => {
    const visit = visits.current.get(route);
    if (!visit || visit.path !== path) return undefined;
    return visit.query ? `${path}?${visit.query}` : path;
  }, []);
  const value = useMemo(
    () => ({ lastVisit, rememberVisit, routeLabels, setRouteLabel, topInset: TOP_BAR_HEIGHT }),
    [lastVisit, rememberVisit, routeLabels, setRouteLabel],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShellRouteLabels(): RouteLabels {
  return useContext(ShellContext)?.routeLabels ?? {};
}

export function useShellVisits() {
  const context = useContext(ShellContext);
  if (!context) throw new Error("Shell visits are only tracked inside the application shell.");
  return { lastVisit: context.lastVisit, rememberVisit: context.rememberVisit };
}

/** Space reserved for the overlaying top bar; screens rendered outside the shell reserve none. */
export function useShellTopInset(): number {
  return useContext(ShellContext)?.topInset ?? 0;
}

/**
 * Names a record in the breadcrumb (for example a customer name) once its read has succeeded.
 * Screens rendered outside the shell, such as isolated tests, have no breadcrumb to update.
 */
export function useRouteLabel(route: ShellRoute, label: string | undefined) {
  const setRouteLabel = useContext(ShellContext)?.setRouteLabel;
  useEffect(() => {
    if (!setRouteLabel) return;
    setRouteLabel(route, label);
    return () => setRouteLabel(route, undefined);
  }, [label, route, setRouteLabel]);
}
