import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
  queries: {} as Record<
    string,
    {
      data: unknown;
      error: unknown;
      fetchStatus: string;
      isPending: boolean;
      isFetching: boolean;
      isError: boolean;
      hasNextPage: boolean;
      isFetchingNextPage: boolean;
      refetch: () => void;
    }
  >,
  navigate: vi.fn(),
  randomUUID: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  mutation: { isPending: false, error: null as unknown, mutate: vi.fn(), reset: vi.fn() },
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const index = fixture.index++;
    if (!(index in fixture.states))
      fixture.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      fixture.states[index],
      (value: unknown) => {
        fixture.states[index] = typeof value === "function" ? value(fixture.states[index]) : value;
      },
    ];
  },
  useEffect: (effect: () => void) => fixture.effects.push(effect),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { queryKey: readonly unknown[] }) =>
    fixture.queries[options.queryKey[0] === "businesses" ? "businesses" : "sale"],
  useMutation: () => fixture.mutation,
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
vi.mock("expo-router", () => ({
  Redirect: "redirect",
  useRouter: () => ({ replace: fixture.navigate, push: fixture.navigate }),
  useLocalSearchParams: () => ({ saleId: "sale" }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: fixture.randomUUID }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  Check: () => null,
  WifiOff: () => null,
  CheckCircle2: () => null,
  Pencil: () => null,
  Plus: () => null,
}));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { business: unknown } | undefined) => data?.business,
}));
vi.mock("@/lib/api-client", async () => ({
  ...(await import("@/lib/api-error")),
  apiRequest: vi.fn(),
  api: { sales: { create: vi.fn(), void: vi.fn(), replace: vi.fn() } },
}));

import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import SaleCorrectionScreen from "./sale-correction-screen";
import SaleDetailScreen from "./sale-detail-screen";

function query(data: unknown) {
  return {
    data,
    error: null as unknown,
    fetchStatus: "idle",
    isPending: false,
    isFetching: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: vi.fn(),
  };
}
function render<T>(component: () => T): T {
  fixture.index = 0;
  fixture.effects = [];
  const result = component();
  for (const effect of fixture.effects) effect();
  return result;
}
function elements<P>(node: ReactNode, type: unknown): ReactElement<P>[] {
  const result: ReactElement<P>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === type) result.push(child as ReactElement<P>);
    result.push(...elements<P>(child.props.children, type));
  });
  return result;
}

beforeEach(() => {
  fixture.states = [];
  fixture.mutation.isPending = false;
  fixture.mutation.error = null;
  vi.clearAllMocks();
  fixture.queries = {
    businesses: query({
      business: {
        id: "business",
        name: "Shop",
        timeZone: "UTC",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        access: { permissions: ["sales:create", "sales:correct"] },
      },
    }),
    sale: query({
      sale: {
        id: "sale",
        grossMinorUnits: "500",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        status: "posted",
        occurredLocalDate: "2026-09-10",
        occurredLocalTime: "12:00",
        timeZone: "UTC",
        correction: null,
        description: null,
      },
    }),
  };
});
function button(node: ReactNode, match: (props: ComponentProps<typeof Button>) => boolean) {
  const found = elements<ComponentProps<typeof Button>>(node, Button).find(({ props }) =>
    match(props),
  );
  if (!found) throw new Error("Expected button");
  return found.props;
}
function press(props: ComponentProps<typeof Button>) {
  (props.onPress as (() => void) | undefined)?.();
}
function setFailure(dependency: "businesses" | "sale", failure: "paused" | "error") {
  const source = fixture.queries[dependency];
  if (!source) throw new Error("Missing query fixture");
  if (failure === "paused") source.fetchStatus = "paused";
  else {
    source.isError = true;
    source.error = new ApiClientError("Unavailable", 503);
  }
}
function recover(dependency: "businesses" | "sale") {
  const source = fixture.queries[dependency];
  if (!source) throw new Error("Missing query fixture");
  Object.assign(source, { fetchStatus: "idle", isError: false, error: null });
}
const cases = [
  { screen: "correction", dependency: "businesses" },
  { screen: "correction", dependency: "sale" },
] as const;
describe.each(["paused", "error"] as const)("sales with cached %s reads", (failure) => {
  test.each(cases)(
    "$screen preserves exact confirmation when $dependency cannot refresh",
    ({ screen, dependency }) => {
      const component = SaleCorrectionScreen;
      let tree = render(component);
      const reason = elements<ComponentProps<typeof Field>>(tree, Field).find(
        ({ props }) => props.label === "sales.correction.reason",
      );
      reason?.props.onChangeText?.("Wrong sale");
      const reviewLabel = "sales.correction.review";
      setFailure(dependency, failure);
      tree = render(component);
      expect(elements(tree, StaleNotice)).toHaveLength(1);
      const reviewButton = button(tree, ({ label }) => label === reviewLabel);
      expect(reviewButton.disabled).toBe(true);
      press(reviewButton);
      expect(fixture.randomUUID).not.toHaveBeenCalled();
      expect(fixture.mutation.mutate).not.toHaveBeenCalled();
      recover(dependency);
      press(button(render(component), ({ label }) => label === reviewLabel));
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      setFailure(dependency, failure);
      tree = render(component);
      const confirmation = button(tree, ({ variant }) => variant === "accent");
      expect(confirmation.disabled).toBe(true);
      press(confirmation);
      expect(fixture.mutation.mutate).not.toHaveBeenCalled();
      const beforeRefresh = fixture.states.slice();
      const notice = elements<ComponentProps<typeof StaleNotice>>(tree, StaleNotice)[0];
      if (!notice) throw new Error("Missing stale notice");
      press(button(StaleNotice(notice.props), ({ label }) => label === "common.retry"));
      expect(fixture.queries.businesses?.refetch).toHaveBeenCalledTimes(1);
      if (screen === "correction") expect(fixture.queries.sale?.refetch).toHaveBeenCalledTimes(1);
      fixture.states.forEach((value, index) => {
        expect(value).toBe(beforeRefresh[index]);
      });
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      expect(fixture.mutation.reset).toHaveBeenCalledTimes(1);
      const refreshingSource = fixture.queries[dependency];
      if (!refreshingSource) throw new Error("Missing query fixture");
      refreshingSource.isFetching = true;
      const loadingNotice = elements<ComponentProps<typeof StaleNotice>>(
        render(component),
        StaleNotice,
      )[0];
      expect(loadingNotice?.props?.loading).toBe(true);
      const loadingRetry = button(
        StaleNotice(loadingNotice?.props),
        ({ label }) => label === "common.retry",
      );
      expect(loadingRetry.loading).toBe(true);
      expect(loadingRetry.onPress).toBeUndefined();
      refreshingSource.isFetching = false;
      recover(dependency);
      expect(elements(render(component), StaleNotice)).toHaveLength(0);
      fixture.states.forEach((value, index) => {
        expect(value).toBe(beforeRefresh[index]);
      });
      press(button(render(component), ({ variant }) => variant === "accent"));
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(1);
      const originalCommand = fixture.mutation.mutate.mock.calls[0]?.[0];
      expect(originalCommand.command.idempotencyKey).toBe("11111111-1111-4111-8111-111111111111");
      fixture.mutation.isPending = true;
      setFailure(dependency, failure);
      tree = render(component);
      press(button(tree, ({ variant }) => variant === "accent"));
      press(button(tree, ({ label }) => label === "sales.edit"));
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(1);
      fixture.mutation.isPending = false;
      fixture.mutation.error = new ApiClientError("Response lost", 0);
      tree = render(component);
      expect(elements(tree, StaleNotice)).toHaveLength(1);
      expect(
        elements<ComponentProps<typeof Button>>(tree, Button).some(
          ({ props }) => props.label === "sales.edit",
        ),
      ).toBe(false);
      const retry = button(tree, ({ variant }) => variant === "accent");
      expect(retry.disabled).toBe(false);
      press(retry);
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(2);
      expect(fixture.mutation.mutate.mock.calls[1]?.[0]).toBe(originalCommand);
      expect(fixture.randomUUID).toHaveBeenCalledTimes(1);
      expect(fixture.mutation.reset).toHaveBeenCalledTimes(1);
    },
  );
  test.each(["businesses", "sale"] as const)(
    "sale detail blocks new command navigation when %s is stale",
    (dependency) => {
      setFailure(dependency, failure);
      const tree = render(SaleDetailScreen);
      expect(elements(tree, StaleNotice)).toHaveLength(1);
      const actions = elements<ComponentProps<typeof Button>>(tree, Button).filter(
        ({ props }) => props.disabled,
      );
      expect(actions).toHaveLength(2);
      for (const action of actions) press(action.props);
      expect(fixture.navigate).not.toHaveBeenCalled();
      const notice = elements<ComponentProps<typeof StaleNotice>>(tree, StaleNotice)[0];
      if (!notice) throw new Error("Missing stale notice");
      press(button(StaleNotice(notice.props), ({ label }) => label === "common.retry"));
      expect(fixture.queries.businesses?.refetch).toHaveBeenCalledTimes(1);
      expect(fixture.queries.sale?.refetch).toHaveBeenCalledTimes(1);
      expect(fixture.navigate).not.toHaveBeenCalled();
      recover(dependency);
      press(button(render(SaleDetailScreen), ({ variant }) => variant === "accent"));
      expect(fixture.navigate).toHaveBeenCalledWith("/operate/sales/new");
    },
  );
});
