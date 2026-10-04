import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => unknown)[],
  cleanups: [] as unknown[],
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
  mutation: {
    isPending: false,
    isSuccess: false,
    error: null as unknown,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
  mutationOptions: undefined as
    | { onSuccess: (result: unknown, input: unknown) => Promise<void> }
    | undefined,
  notify: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  routeLabel: vi.fn(),
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
  useRef: (initial: unknown) => {
    const index = fixture.index++;
    if (!(index in fixture.states)) fixture.states[index] = { current: initial };
    return fixture.states[index];
  },
  useEffect: (effect: () => unknown) => fixture.effects.push(effect),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { queryKey: readonly unknown[] }) =>
    fixture.queries[options.queryKey[0] === "businesses" ? "businesses" : "sale"],
  useMutation: (options: typeof fixture.mutationOptions) => {
    fixture.mutationOptions = options;
    return fixture.mutation;
  },
  useQueryClient: () => ({ invalidateQueries: async () => undefined }),
}));
vi.mock("expo-router", () => ({
  Link: "link",
  Redirect: "redirect",
  useRouter: () => ({
    replace: fixture.navigate,
    push: fixture.navigate,
    navigate: fixture.navigate,
  }),
  useLocalSearchParams: () => ({ saleId: "sale" }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: fixture.randomUUID }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#525252") : "#525252",
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { business: unknown } | undefined) => data?.business,
}));
vi.mock("@/lib/api-client", async () => ({
  ...(await import("@/lib/api-error")),
  apiRequest: vi.fn(),
  api: { sales: { void: vi.fn(), replace: vi.fn() } },
}));
vi.mock("@/lib/notify", () => ({ notify: fixture.notify }));
vi.mock("@/components/shell/shell-context", () => ({ useRouteLabel: fixture.routeLabel }));

import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { elements } from "../../../test-support/element-tree";
import { CorrectionModeField } from "./correction-mode-field";
import { SalesRouteState } from "./route-state";
import SaleCorrectionScreen from "./sale-correction-screen";
import SaleDetailScreen from "./sale-detail-screen";
import { SaleDraftFields } from "./sale-draft-fields";

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
  fixture.cleanups = fixture.effects.map((effect) => effect());
  return result;
}

beforeEach(() => {
  fixture.states = [];
  fixture.mutation.isPending = false;
  fixture.mutation.isSuccess = false;
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
        access: { permissions: ["sales:read", "sales:create", "sales:correct"] },
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
        occurredAt: "2026-09-10T12:00:00.000Z",
        createdAt: "2026-09-10T12:01:00.000Z",
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
      const confirmVoid = "sales.correction.confirmVoid";
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
      const confirmation = button(tree, ({ label }) => label === confirmVoid);
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
      press(button(render(component), ({ label }) => label === confirmVoid));
      expect(fixture.mutation.mutate).toHaveBeenCalledTimes(1);
      const originalCommand = fixture.mutation.mutate.mock.calls[0]?.[0];
      expect(originalCommand.command.idempotencyKey).toBe("11111111-1111-4111-8111-111111111111");
      fixture.mutation.isPending = true;
      setFailure(dependency, failure);
      tree = render(component);
      press(button(tree, ({ label }) => label === confirmVoid));
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
      const retry = button(tree, ({ label }) => label === "common.retrySameConfirmation");
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
      const fresh = render(SaleDetailScreen);
      expect(
        elements<ComponentProps<typeof Button>>(fresh, Button).some(({ props }) => props.disabled),
      ).toBe(false);
      expect(elements<{ href: unknown }>(fresh, "link").map(({ props }) => props.href)).toEqual([
        { pathname: "/operate/sales/correct/[saleId]", params: { saleId: "sale" } },
        "/operate/sales/new",
      ]);
    },
  );
});

describe("confirmed sale corrections", () => {
  const detail = (saleId: string) => ({ pathname: "/operate/sales/[saleId]", params: { saleId } });
  const money = { currency: "USD", currencyMinorUnitDigits: 2 };
  const key = "11111111-1111-4111-8111-111111111111";
  function confirm(result: unknown, kind: "void" | "replacement") {
    render(SaleCorrectionScreen);
    const options = fixture.mutationOptions;
    if (!options) throw new Error("Missing correction mutation");
    return options.onSuccess(result, {
      businessId: "business",
      saleId: "sale",
      kind,
      command: { idempotencyKey: key, reason: "Wrong sale" },
    });
  }

  test("announces a void and opens the corrected sale", async () => {
    await confirm(
      {
        originalSale: { id: "sale", grossMinorUnits: "500", status: "voided", ...money },
        replacementSale: null,
      },
      "void",
    );
    const [title, options] = fixture.notify.success.mock.calls[0] ?? [];
    expect(title).toBe("sales.correction.voided");
    expect(options.description).toBe("$5.00");
    expect(options.action.label).toBe("sales.viewSale");
    expect(fixture.navigate).toHaveBeenCalledWith(detail("sale"));
  });

  test("does not pull the person back to the sale after they left the screen", async () => {
    render(SaleCorrectionScreen);
    const options = fixture.mutationOptions;
    if (!options) throw new Error("Missing correction mutation");
    for (const cleanup of fixture.cleanups) if (typeof cleanup === "function") cleanup();
    await options.onSuccess(
      {
        originalSale: { id: "sale", grossMinorUnits: "500", status: "voided", ...money },
        replacementSale: null,
      },
      { businessId: "business", saleId: "sale", kind: "void", command: { idempotencyKey: key } },
    );
    expect(fixture.notify.success).toHaveBeenCalledTimes(1);
    expect(fixture.navigate).not.toHaveBeenCalled();
    fixture.notify.success.mock.calls[0]?.[1].action.onPress();
    expect(fixture.navigate).toHaveBeenCalledWith(detail("sale"));
  });

  test("announces a replacement with a link to the new sale", async () => {
    await confirm(
      {
        originalSale: { id: "sale", grossMinorUnits: "500", status: "voided", ...money },
        replacementSale: { id: "replacement", grossMinorUnits: "700", status: "posted", ...money },
      },
      "replacement",
    );
    const [title, options] = fixture.notify.success.mock.calls[0] ?? [];
    expect(title).toBe("sales.correction.replaced");
    expect(options.description).toBe("$7.00");
    expect(options.action.label).toBe("sales.correction.viewReplacement");
    expect(fixture.navigate).toHaveBeenCalledWith(detail("sale"));
    options.action.onPress();
    expect(fixture.navigate).toHaveBeenLastCalledWith(detail("replacement"));
  });

  test("keeps the review while a confirmed correction refreshes the sale it voided", () => {
    let tree = render(SaleCorrectionScreen);
    const reason = elements<ComponentProps<typeof Field>>(tree, Field).find(
      ({ props }) => props.label === "sales.correction.reason",
    );
    reason?.props.onChangeText?.("Wrong sale");
    press(button(render(SaleCorrectionScreen), ({ label }) => label === "sales.correction.review"));
    const sale = fixture.queries.sale?.data as { sale: Record<string, unknown> };
    sale.sale = {
      ...sale.sale,
      status: "voided",
      correction: {
        id: "correction",
        kind: "void",
        reason: "Wrong sale",
        originalSaleId: "sale",
        replacementSaleId: null,
        correctedAt: "2026-09-10T12:05:00.000Z",
      },
    };
    const confirmLabel = "sales.correction.confirmVoid";
    for (const phase of ["isPending", "isSuccess"] as const) {
      fixture.mutation[phase] = true;
      tree = render(SaleCorrectionScreen);
      expect(button(tree, ({ label }) => label === confirmLabel).disabled).toBe(
        phase === "isSuccess",
      );
      fixture.mutation[phase] = false;
    }
    tree = render(SaleCorrectionScreen);
    expect(
      elements<ComponentProps<typeof Button>>(tree, Button).some(
        ({ props }) => props.label === confirmLabel,
      ),
    ).toBe(false);
  });

  test("names the sale in the breadcrumb once it has loaded", () => {
    render(SaleDetailScreen);
    expect(fixture.routeLabel).toHaveBeenCalledWith("/operate/sales/[saleId]", "$5.00");
  });
});

describe("correction editor", () => {
  function chooseMode(mode: "void" | "replacement") {
    const field = elements<ComponentProps<typeof CorrectionModeField>>(
      render(SaleCorrectionScreen),
      CorrectionModeField,
    )[0];
    if (!field) throw new Error("Missing correction mode");
    field.props.onChange(mode);
  }
  function draftFields() {
    return elements<ComponentProps<typeof SaleDraftFields>>(
      render(SaleCorrectionScreen),
      SaleDraftFields,
    )[0];
  }

  test("starts an untouched replacement from the original sale and keeps later edits", () => {
    chooseMode("replacement");
    expect(draftFields()?.props.values).toEqual({
      amount: "5.00",
      date: "2026-09-10",
      time: "12:00",
      description: "",
    });
    draftFields()?.props.onChange("amount", "4.50");
    chooseMode("void");
    chooseMode("replacement");
    expect(draftFields()?.props.values.amount).toBe("4.50");
  });

  test("leaves the amount empty when the business now records another currency", () => {
    const businesses = fixture.queries.businesses;
    if (!businesses) throw new Error("Missing business fixture");
    (businesses.data as { business: { currency: string } }).business.currency = "EUR";
    chooseMode("replacement");
    expect(draftFields()?.props.values).toMatchObject({ amount: "", date: "2026-09-10" });
  });

  test("leaves the moment empty when the business now uses another time zone", () => {
    const businesses = fixture.queries.businesses;
    if (!businesses) throw new Error("Missing business fixture");
    (businesses.data as { business: { timeZone: string } }).business.timeZone =
      "America/El_Salvador";
    chooseMode("replacement");
    expect(draftFields()?.props.values).toEqual({
      amount: "5.00",
      date: "",
      time: "",
      description: "",
    });
  });

  test("puts focus on Editar, never on the irreversible confirmation", () => {
    const reason = elements<ComponentProps<typeof Field>>(render(SaleCorrectionScreen), Field).find(
      ({ props }) => props.label === "sales.correction.reason",
    );
    reason?.props.onChangeText?.("Wrong sale");
    press(button(render(SaleCorrectionScreen), ({ label }) => label === "sales.correction.review"));
    const tree = render(SaleCorrectionScreen);
    expect(button(tree, ({ label }) => label === "sales.edit").ref).toBeDefined();
    expect(
      button(tree, ({ label }) => label === "sales.correction.confirmVoid").ref,
    ).toBeUndefined();
  });
});

describe("sale detail states", () => {
  test.each([
    ["notFound", new ApiClientError("Missing", 404, "NOT_FOUND")],
    ["error", new ApiClientError("Unavailable", 503)],
    ["denied", new ApiClientError("Forbidden", 403, "FORBIDDEN")],
  ] as const)("shows %s when the sale read fails without data", (kind, error) => {
    Object.assign(fixture.queries.sale ?? {}, { data: undefined, error, isError: true });
    const tree = render(SaleDetailScreen);
    expect(tree.type).toBe(SalesRouteState);
    expect(tree.props.kind).toBe(kind);
  });

  test("tells a paused first read apart from one still loading", () => {
    Object.assign(fixture.queries.sale ?? {}, { data: undefined, fetchStatus: "paused" });
    expect(render(SaleDetailScreen).props.kind).toBe("offline");
    Object.assign(fixture.queries.sale ?? {}, { fetchStatus: "fetching", isPending: true });
    expect(render(SaleDetailScreen).props.kind).toBe("loading");
  });

  test("withholds the sale from a role that cannot read sales", () => {
    const businesses = fixture.queries.businesses;
    if (!businesses) throw new Error("Missing business fixture");
    (businesses.data as { business: { access: unknown } }).business.access = {
      permissions: ["sales:create"],
    };
    const tree = render(SaleDetailScreen);
    expect(tree.type).toBe(SalesRouteState);
    expect(tree.props.kind).toBe("denied");
  });

  test("never offers correcting a sale that replaced another one", () => {
    const data = fixture.queries.sale?.data as { sale: Record<string, unknown> };
    data.sale = {
      ...data.sale,
      correction: {
        id: "correction",
        kind: "replacement",
        reason: "Wrong total",
        originalSaleId: "original",
        replacementSaleId: "sale",
        correctedAt: "2026-09-10T12:05:00.000Z",
      },
    };
    const links = elements<{ href: unknown }>(render(SaleDetailScreen), "link");
    expect(links.map(({ props }) => props.href)).toEqual(["/operate/sales/new"]);
  });
});
