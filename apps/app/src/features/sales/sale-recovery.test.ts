import type { SaleReview } from "@pisto/contracts";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

type MutationOptions = {
  mutationFn: (value: unknown) => Promise<unknown>;
  onMutate?: () => Promise<unknown>;
  onSuccess?: (result: unknown, value: unknown) => unknown;
  onError?: () => unknown;
  onSettled?: () => unknown;
};
type Mutation = {
  options: MutationOptions;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  mutate: (value: unknown) => void;
  reset: () => void;
};
const fixture = vi.hoisted(() => ({
  hooks: [] as unknown[],
  hookIndex: 0,
  mutationIndex: 0,
  effects: [] as (() => unknown)[],
  mutations: [] as Mutation[],
  tasks: [] as Promise<void>[],
  review: null as SaleReview | null,
  recovery: {
    data: undefined as { review: SaleReview | null } | undefined,
    error: null as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
  },
  businesses: {
    data: {
      business: {
        id: "business",
        name: "Shop",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        timeZone: "America/El_Salvador",
        createdAt: "2026-09-26T20:30:00.000Z",
        access: { role: "owner" as const, permissions: ["sales:create" as const] },
      },
    },
    error: null as unknown,
    isPending: false,
    isError: false,
    isFetching: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
  },
  navigate: vi.fn(),
  key: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
  api: { get: vi.fn(), prepare: vi.fn(), confirm: vi.fn(), dismiss: vi.fn() },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => unknown) => fixture.effects.push(effect),
  useState: (initial: unknown) => {
    const index = fixture.hookIndex++;
    if (!(index in fixture.hooks))
      fixture.hooks[index] = typeof initial === "function" ? initial() : initial;
    return [
      fixture.hooks[index],
      (value: unknown) => {
        fixture.hooks[index] = typeof value === "function" ? value(fixture.hooks[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = fixture.hookIndex++;
    if (!(index in fixture.hooks)) fixture.hooks[index] = { current: initial };
    return fixture.hooks[index];
  },
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "businesses" ? fixture.businesses : fixture.recovery,
  useQueryClient: () => ({
    cancelQueries: async () => undefined,
    setQueryData: (_key: unknown, data: { review: SaleReview | null }) => {
      fixture.recovery.data = data;
    },
    invalidateQueries: async ({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "sales") fixture.recovery.data = await fixture.api.get();
    },
  }),
  useMutation: (options: MutationOptions) => {
    const index = fixture.mutationIndex++;
    if (!fixture.mutations[index]) {
      const state: Mutation = {
        options,
        isPending: false,
        isError: false,
        error: null,
        reset() {
          state.isError = false;
          state.error = null;
        },
        mutate(value) {
          state.isPending = true;
          const current = state.options;
          fixture.tasks.push(
            (async () => {
              try {
                await current.onMutate?.();
                const result = await current.mutationFn(value);
                await current.onSuccess?.(result, value);
              } catch (error) {
                state.error = error;
                state.isError = true;
                await current.onError?.();
              } finally {
                state.isPending = false;
                await current.onSettled?.();
              }
            })(),
          );
        },
      };
      fixture.mutations[index] = state;
    }
    const mutation = fixture.mutations[index];
    if (!mutation) throw new Error("Missing mutation fixture");
    mutation.options = options;
    return mutation;
  },
}));
vi.mock("expo-router", () => ({
  Redirect: "redirect",
  useRouter: () => ({ replace: fixture.navigate }),
}));
vi.mock("expo-crypto", () => ({ randomUUID: fixture.key }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("lucide-react-native", () => ({ WifiOff: () => null }));
vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: { queryKey: ["businesses"] },
  getActiveBusiness: (data: { business: unknown } | undefined) => data?.business,
}));
vi.mock("@/lib/api-client", async () => ({
  ...(await import("@/lib/api-error")),
  api: { sales: { review: fixture.api } },
}));

import { Button } from "@/components/ui/button";
import NewSaleScreen, { SaleReviewScreen } from "./sale-create-screen";
import { SaleDraftFields } from "./sale-draft-fields";

function review(): SaleReview {
  const id = "11111111-1111-4111-8111-111111111111";
  return {
    id,
    businessId: "business",
    command: {
      idempotencyKey: id,
      grossMinorUnits: "1250",
      occurredLocalDate: "2026-09-26",
      occurredLocalTime: "14:30",
      description: "Preserved note",
    },
    currency: "USD",
    currencyMinorUnitDigits: 2,
    timeZone: "America/El_Salvador",
    createdAt: "2026-09-26T20:30:00.000Z",
    saleId: null,
  };
}
function render() {
  fixture.hookIndex = 0;
  fixture.mutationIndex = 0;
  fixture.effects = [];
  const tree = SaleReviewScreen({
    business: fixture.businesses.data.business,
    businessStale: fixture.businesses.isError || fixture.businesses.fetchStatus === "paused",
    businessFetching: fixture.businesses.isFetching,
    onRefreshBusiness: fixture.businesses.refetch,
  });
  for (const effect of fixture.effects) effect();
  return tree;
}
function elements<P>(node: ReactNode, type: unknown): ReactElement<P>[] {
  const found: ReactElement<P>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === type) found.push(child as ReactElement<P>);
    found.push(...elements<P>(child.props.children, type));
  });
  return found;
}
function button(label: string) {
  const found = elements<ComponentProps<typeof Button>>(render(), Button).find(
    ({ props }) => props.label === label,
  );
  if (!found) throw new Error(`Missing button ${label}`);
  return found.props;
}
async function press(label: string) {
  const props = button(label);
  (props.onPress as (() => void) | undefined)?.();
  await Promise.all(fixture.tasks.splice(0));
}
function restore(value: SaleReview | null) {
  fixture.review = value;
  fixture.recovery.data = { review: value };
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.hooks = [];
  fixture.mutations = [];
  fixture.tasks = [];
  Object.assign(fixture.businesses, {
    isError: false,
    isFetching: false,
    error: null,
    fetchStatus: "idle",
  });
  fixture.businesses.data.business.timeZone = "America/El_Salvador";
  Object.assign(fixture.recovery, {
    isError: false,
    isPending: false,
    isFetching: false,
    error: null,
    fetchStatus: "idle",
  });
  restore(null);
  fixture.api.get.mockImplementation(async () => ({ review: fixture.review }));
  fixture.api.prepare.mockImplementation(async (command) => {
    fixture.review = { ...review(), command, id: command.idempotencyKey };
    return { review: fixture.review };
  });
  fixture.api.confirm.mockImplementation(async () => {
    if (!fixture.review) throw new Error("Missing server review");
    fixture.review = { ...fixture.review, saleId: "22222222-2222-4222-8222-222222222222" };
    return { sale: { id: fixture.review.saleId }, replayed: false };
  });
  fixture.api.dismiss.mockImplementation(async (_id, acknowledgedSaleId) => {
    const saleId = fixture.review?.saleId ?? null;
    if (!saleId || saleId === acknowledgedSaleId) fixture.review = null;
    return { saleId };
  });
});

describe("new sale durable recovery screen", () => {
  test("keys the editor by business so a business change discards only local component state", () => {
    const tree = NewSaleScreen();
    expect(tree.key).toBe("business");
    expect(tree.type).toBe(SaleReviewScreen);
  });
  test("restores the exact review on remount and never submits on render", () => {
    restore(review());
    render();
    fixture.hooks = [];
    fixture.mutations = [];
    render();
    expect(button("sales.confirm").disabled).toBe(false);
    expect(fixture.key).not.toHaveBeenCalled();
    expect(fixture.api.prepare).not.toHaveBeenCalled();
    expect(fixture.api.confirm).not.toHaveBeenCalled();
    expect(fixture.api.dismiss).not.toHaveBeenCalled();
  });
  test.each(["paused", "error", "fetching"])(
    "blocks every financial action while a read is %s",
    async (kind) => {
      restore(review());
      if (kind === "error") {
        fixture.recovery.isError = true;
        fixture.recovery.error = new ApiClientError("Failed", 503);
      } else if (kind === "paused") fixture.recovery.fetchStatus = "paused";
      else fixture.recovery.isFetching = true;
      expect(button("sales.confirm").disabled).toBe(true);
      await press("sales.confirm");
      await press("sales.edit");
      expect(fixture.api.confirm).not.toHaveBeenCalled();
      expect(fixture.api.dismiss).not.toHaveBeenCalled();
    },
  );
  test("does not show a fresh form before recovery has a result", () => {
    fixture.recovery.data = undefined;
    fixture.recovery.isPending = true;
    expect(elements(render(), SaleDraftFields)).toHaveLength(0);
    expect(fixture.api.prepare).not.toHaveBeenCalled();
  });
  test("preserves the original ID on an explicit retry after a lost response and remount", async () => {
    restore(review());
    fixture.api.confirm.mockRejectedValueOnce(new ApiClientError("Lost response", 0));
    await press("sales.confirm");
    fixture.hooks = [];
    fixture.mutations = [];
    await press("sales.confirm");
    expect(fixture.api.confirm.mock.calls.map(([id]) => id)).toEqual([review().id, review().id]);
    expect(fixture.key).not.toHaveBeenCalled();
    expect(fixture.navigate).toHaveBeenCalledWith({
      pathname: "/operate/sales/[saleId]",
      params: { saleId: fixture.review?.saleId },
    });
  });
  test("recovers a preparation whose server response was lost", async () => {
    const fields = elements<ComponentProps<typeof SaleDraftFields>>(render(), SaleDraftFields)[0];
    if (!fields) throw new Error("Missing draft");
    fields.props.onChange("amount", "12.50");
    fields.props.onChange("date", "2026-09-26");
    fields.props.onChange("time", "14:30");
    fixture.api.prepare.mockImplementationOnce(async (command) => {
      fixture.review = { ...review(), command };
      throw new ApiClientError("Lost prepare", 0);
    });
    await press("sales.review");
    expect(button("sales.confirm").disabled).toBe(false);
    expect(fixture.api.prepare).toHaveBeenCalledTimes(1);
    expect(fixture.api.confirm).not.toHaveBeenCalled();
  });
  test("shows a saved result instead of inviting a second confirmation", async () => {
    restore({ ...review(), saleId: "22222222-2222-4222-8222-222222222222" });
    expect(
      elements<ComponentProps<typeof Button>>(render(), Button).some(
        ({ props }) => props.label === "sales.confirm",
      ),
    ).toBe(false);
    await press("sales.registerAnother");
    expect(fixture.api.dismiss).toHaveBeenCalledWith(
      review().id,
      "22222222-2222-4222-8222-222222222222",
    );
    expect(elements(render(), SaleDraftFields)).toHaveLength(1);
  });
  test("editing acknowledges no sale and navigates to a concurrent committed result", async () => {
    restore(review());
    fixture.review = { ...review(), saleId: "22222222-2222-4222-8222-222222222222" };
    await press("sales.edit");
    expect(fixture.api.dismiss).toHaveBeenCalledWith(review().id, null);
    expect(fixture.recovery.data?.review?.saleId).toBe(fixture.review.saleId);
    expect(fixture.navigate).toHaveBeenCalled();
    expect(fixture.api.prepare).not.toHaveBeenCalled();
  });
  test("editing an unsubmitted review restores exact fields but needs a new explicit review", async () => {
    restore(review());
    await press("sales.edit");
    const fields = elements<ComponentProps<typeof SaleDraftFields>>(render(), SaleDraftFields)[0];
    expect(fields?.props.values).toEqual({
      amount: "12.50",
      date: "2026-09-26",
      time: "14:30",
      description: "Preserved note",
    });
    expect(fixture.api.prepare).not.toHaveBeenCalled();
    expect(fixture.api.confirm).not.toHaveBeenCalled();
  });
  test("refuses to confirm a review with changed currency or time-zone meaning", async () => {
    restore(review());
    fixture.businesses.data.business.timeZone = "UTC";
    expect(button("sales.confirm").disabled).toBe(true);
    await press("sales.confirm");
    expect(fixture.api.confirm).not.toHaveBeenCalled();
  });
  test("does not display a review belonging to another active business", () => {
    restore({ ...review(), businessId: "other" });
    expect(
      elements<ComponentProps<typeof Button>>(render(), Button).some(
        ({ props }) => props.label === "sales.confirm",
      ),
    ).toBe(false);
    expect(elements(render(), SaleDraftFields)).toHaveLength(0);
  });
  test("an immediate double tap starts only one confirmation", async () => {
    restore(review());
    const action = button("sales.confirm");
    const click = action.onPress as () => void;
    click();
    click();
    await Promise.all(fixture.tasks.splice(0));
    expect(fixture.api.confirm).toHaveBeenCalledTimes(1);
  });
});
