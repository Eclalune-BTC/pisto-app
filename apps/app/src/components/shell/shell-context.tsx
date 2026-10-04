import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ShellRoute } from "@/lib/route-trail";

export const TOP_BAR_HEIGHT = 48;

type RouteLabels = Readonly<Partial<Record<ShellRoute, string>>>;

type ShellContextValue = {
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
  const value = useMemo(
    () => ({ routeLabels, setRouteLabel, topInset: TOP_BAR_HEIGHT }),
    [routeLabels, setRouteLabel],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShellRouteLabels(): RouteLabels {
  return useContext(ShellContext)?.routeLabels ?? {};
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
