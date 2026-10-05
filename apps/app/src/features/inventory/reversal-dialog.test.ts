import type { InventoryMovement, Product } from "@pisto/contracts";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  focusReason: vi.fn(),
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
  notify: vi.fn(),
  invalidate: vi.fn(async () => undefined),
  keys: 0,
}));

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#18181b") : "#18181b",
  withUniwind: (component: unknown) => component,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: () => ({ current: { focus: fixture.focusReason } }),
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
vi.mock("expo-crypto", () => ({
  randomUUID: () => `00000000-0000-4000-8000-00000000000${++fixture.keys}`,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: fixture.notify } }));
vi.mock("@/lib/api-client", () => ({ api: {} }));
vi.mock("./api", () => ({ inventoryApi: {} }));
vi.mock("../catalog/queries", () => ({ invalidateCatalogInventory: fixture.invalidate }));
vi.mock("@/components/ui/confirm-dialog", () => ({ ConfirmDialog: "confirm-dialog" }));

import { Field } from "@/components/ui/field";
import { elements } from "../../../test-support/element-tree";
import { MomentFields } from "./moment-fields";
import { ReversalDialog, reversalDelta } from "./reversal-dialog";

type Rendered = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const timestamp = "2026-09-27T18:00:00.000Z";
const product = { id: "product-a", name: "Coffee", unitKind: "unit" } as Product;
const movement: InventoryMovement = {
  id: "movement-a",
  productId: product.id,
  action: "receive",
  quantityMinorUnits: "12",
  deltaMinorUnits: "12",
  quantityPrecision: 0,
  reason: "Delivery",
  occurredAt: timestamp,
  occurredLocalDate: "2026-09-27",
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  createdByUserId: "user-a",
  reversesMovementId: null,
  reversedByMovementId: null,
  createdAt: timestamp,
};
const onClose = vi.fn();
const opener = { isConnected: true, focus: vi.fn() } as unknown as HTMLElement;
const title = { isConnected: true, focus: vi.fn() } as unknown as HTMLElement;

function render(changes: Partial<Parameters<typeof ReversalDialog>[0]> = {}) {
  fixture.index = 0;
  return ReversalDialog({
    businessId: "business",
    canConfirm: true,
    focus: { opener, title },
    movement,
    onClose,
    product,
    timeZone: "America/El_Salvador",
    ...changes,
  }) as Rendered;
}
function reason(dialog: Rendered) {
  const [field] = elements<{
    editable: boolean;
    error?: string;
    onChangeText: (value: string) => void;
  }>(dialog.props.children, Field);
  if (!field) throw new Error("The reason field is missing.");
  return field.props;
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

describe("movement reversal", () => {
  test("negates the delta as exact text", () => {
    expect(reversalDelta("12")).toBe("-12");
    expect(reversalDelta("-1500")).toBe("1500");
    expect(reversalDelta("9223372036854775807")).toBe("-9223372036854775807");
  });

  test("refuses an empty reason and a lost permission without sending anything", () => {
    (render().props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    expect(reason(render()).error).toBe("inventory.movementEditor.validation.reasonMissing");
    // The refused reason takes focus so it can be written right away.
    expect(fixture.focusReason).toHaveBeenCalledOnce();
    reason(render()).onChangeText("Counted twice");
    (render({ canConfirm: false }).props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    expect(render({ canConfirm: false }).props.disabled).toBe(true);
  });

  test("keeps one key for an uncertain or unchanged retry and freezes the draft meanwhile", () => {
    reason(render()).onChangeText("Counted twice");
    (render().props.onConfirm as () => void)();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0] as { idempotencyKey: string };
    expect(sent).toMatchObject({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      reason: "Counted twice",
    });

    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    const uncertain = render({ canConfirm: false });
    expect(uncertain.props.phase).toBe("uncertain");
    expect(reason(uncertain).editable).toBe(false);
    const [when] = elements<{ disabled: boolean }>(uncertain.props.children, MomentFields);
    expect(when?.props.disabled).toBe(true);
    (uncertain.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);

    Object.assign(fixture.mutation, { error: new ApiClientError("conflict", 409, "CONFLICT") });
    const failed = render();
    expect(failed.props.phase).toBe("failed");
    expect(reason(failed).editable).toBe(true);
    (failed.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
    reason(failed).onChangeText("Supplier returned it");
    (render().props.onConfirm as () => void)();
    expect(fixture.mutation.mutate.mock.lastCall?.[0]).toMatchObject({
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
    });
  });

  test("announces the definitive result, closes and continues from the screen title", async () => {
    expect(render().props.returnFocus).toBe(opener);
    await fixture.mutationOptions?.onSuccess(
      { movement: { ...movement, id: "movement-b", reversesMovementId: movement.id } },
      { idempotencyKey: "00000000-0000-4000-8000-000000000001" },
    );
    expect(fixture.invalidate).toHaveBeenCalledWith({}, "business");
    expect(fixture.notify.mock.lastCall?.[0]).toBe("inventory.reversal.reversed");
    expect(onClose).toHaveBeenCalledOnce();
    // The reversed row no longer offers its menu, so focus cannot go back to it.
    expect(render().props.returnFocus).toBe(title);
  });
});
