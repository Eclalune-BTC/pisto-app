import type { CashMovement } from "@pisto/contracts";
import { Fragment, type ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  mutation: {
    error: null as unknown,
    isError: false,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    variables: undefined as unknown,
  },
  mutationOptions: undefined as
    | { onSuccess: (result: unknown, variables: { idempotencyKey: string }) => Promise<void> }
    | undefined,
  keys: 0,
  notify: vi.fn(),
  invalidate: vi.fn(async () => undefined),
}));

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#18181b") : "#18181b",
  withUniwind: (component: unknown) => component,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
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
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useMutation: (options: NonNullable<typeof fixture.mutationOptions>) => {
    fixture.mutationOptions = options;
    return fixture.mutation;
  },
  useQueryClient: () => ({}),
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => `key-${++fixture.keys}` }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: fixture.notify } }));
vi.mock("./api", () => ({ cashApi: { movements: {} } }));
vi.mock("./invalidate", () => ({ invalidateCashLedger: fixture.invalidate }));
vi.mock("./cash-movement-dialogs", () => ({
  CashMovementDialog: "movement-dialog",
  CashReversalDialog: "reversal-dialog",
}));

import { CashMovementDetail } from "./cash-movement-detail-controller";

type Rendered = ReactElement<Record<string, unknown>>;

const adjustment = {
  id: "movement",
  accountId: "account",
  action: "adjustment_out",
  amountMinorUnits: "500",
  createdAt: "2026-09-10T16:05:00Z",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  deltaMinorUnits: "-500",
  occurredAt: "2026-09-10T16:00:00Z",
  reason: "Conteo",
  reversalOfMovementId: null,
  timeZone: "America/El_Salvador",
} as CashMovement;
const onClose = vi.fn();

function render(props: Partial<Parameters<typeof CashMovementDetail>[0]> = {}) {
  fixture.index = 0;
  const element = CashMovementDetail({
    accountName: "Caja",
    businessId: "business",
    canManage: true,
    movement: adjustment,
    movements: [adjustment],
    onClose,
    timeZone: "America/El_Salvador",
    ...props,
  }) as Rendered;
  expect(element.type).toBe(Fragment);
  const [facts, reversal] = element.props.children as [Rendered, Rendered];
  return { facts, reversal };
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.states = [];
  fixture.keys = 0;
  Object.assign(fixture.mutation, {
    error: null,
    isError: false,
    isPending: false,
    variables: undefined,
  });
});

describe("cash movement reversal", () => {
  test("is offered once, for an adjustment, to a manager", () => {
    expect(render().facts.props.onReverse).toBeTypeOf("function");
    expect(render({ canManage: false }).facts.props.onReverse).toBeUndefined();
    expect(
      render({ movement: { ...adjustment, action: "expense" } }).facts.props.onReverse,
    ).toBeUndefined();
    const reversed = render({
      movements: [adjustment, { ...adjustment, id: "reversal", reversalOfMovementId: "movement" }],
    });
    expect(reversed.facts.props.onReverse).toBeUndefined();
    expect(reversed.facts.props.reversed).toBe(true);
  });

  test("moves from the facts to the confirmation and back", () => {
    (render().facts.props.onReverse as () => void)();
    const { facts, reversal } = render();
    expect(facts.props.open).toBe(false);
    expect(reversal.props.open).toBe(true);
    (reversal.props.onCancel as () => void)();
    expect(fixture.mutation.reset).toHaveBeenCalledOnce();
    expect(render().facts.props.open).toBe(true);
  });

  test("keeps the key for an uncertain or unchanged retry and replaces it for an edit", () => {
    let { reversal } = render();
    (reversal.props.onDraftChange as (draft: unknown) => void)({
      ...(reversal.props.draft as object),
      reason: "Duplicado",
    });
    reversal = render().reversal;
    (reversal.props.onConfirm as () => void)();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0] as { idempotencyKey: string };
    expect(sent.idempotencyKey).toBe("key-1");

    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    reversal = render().reversal;
    expect(reversal.props.phase).toBe("uncertain");
    (reversal.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);

    Object.assign(fixture.mutation, { error: new ApiClientError("conflict", 409, "CONFLICT") });
    reversal = render().reversal;
    expect(reversal.props.errorMessage).toBe("productErrors.conflict");
    (reversal.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);

    (reversal.props.onDraftChange as (draft: unknown) => void)({
      ...(reversal.props.draft as object),
      reason: "Ajuste duplicado",
    });
    (render().reversal.props.onConfirm as () => void)();
    const edited = fixture.mutation.mutate.mock.lastCall?.[0] as { idempotencyKey: string };
    expect(edited.idempotencyKey).not.toBe(sent.idempotencyKey);
  });

  test("resends an uncertain reversal after access or freshness is lost", () => {
    let { reversal } = render();
    (reversal.props.onDraftChange as (draft: unknown) => void)({
      ...(reversal.props.draft as object),
      reason: "Duplicado",
    });
    (render().reversal.props.onConfirm as () => void)();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0];
    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    reversal = render({ canManage: false }).reversal;
    (reversal.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenCalledTimes(2);
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
  });

  test("does not send a command without access or with an invalid draft", () => {
    let { reversal } = render({ canManage: false });
    (reversal.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    reversal = render().reversal;
    (reversal.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    expect(render().reversal.props.errors).toEqual({ reason: "cash.issues.required" });
  });

  test("closes and confirms with a toast only after the server result", async () => {
    render();
    expect(onClose).not.toHaveBeenCalled();
    await fixture.mutationOptions?.onSuccess({}, { idempotencyKey: "sent-key" });
    expect(fixture.invalidate).toHaveBeenCalledWith({}, "business");
    expect(fixture.notify).toHaveBeenCalledWith("cash.reversal.success");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
