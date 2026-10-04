import type { Expense } from "@pisto/contracts";
import type { ReactElement, ReactNode } from "react";
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
  mutationOptions: undefined as { onSuccess: () => Promise<void> } | undefined,
  router: { push: vi.fn() },
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
  useMutation: (options: { onSuccess: () => Promise<void> }) => {
    fixture.mutationOptions = options;
    return fixture.mutation;
  },
  useQueryClient: () => ({}),
}));
vi.mock("expo-router", () => ({ useRouter: () => fixture.router }));
vi.mock("expo-crypto", () => ({ randomUUID: () => `key-${++fixture.keys}` }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { resolvedLanguage: "es-SV" }, t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: fixture.notify } }));
vi.mock("../cash/api", () => ({ cashApi: { expenses: {} } }));
vi.mock("../cash/invalidate", () => ({ invalidateExpensesAndCash: fixture.invalidate }));
vi.mock("../cash/confirm-command-dialog", () => ({ ConfirmCommandDialog: "confirm-dialog" }));

import { Field } from "@/components/ui/field";
import { elements } from "../../../test-support/element-tree";
import { LocalDateTimeFields } from "../cash/local-date-time-fields";
import { ExpenseVoidDialog } from "./expense-void-dialog";

type Rendered = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const expense = {
  id: "expense-a",
  amountMinorUnits: "1475",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  description: "Energía eléctrica",
} as Expense;
const onClose = vi.fn();

function render(changes: Partial<Parameters<typeof ExpenseVoidDialog>[0]> = {}) {
  fixture.index = 0;
  return ExpenseVoidDialog({
    businessId: "business",
    canConfirm: true,
    expense,
    onClose,
    timeZone: "America/El_Salvador",
    ...changes,
  }) as Rendered;
}
function reason(dialog: Rendered) {
  const [field] = elements<{ editable: boolean; onChangeText: (value: string) => void }>(
    dialog.props.children,
    Field,
  );
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

describe("expense void confirmation", () => {
  test("refuses an empty reason and a lost permission without sending anything", () => {
    (render().props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    reason(render()).onChangeText("Registro duplicado");
    (render({ canConfirm: false }).props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    expect(render({ canConfirm: false }).props.disabled).toBe(true);
  });

  test("keeps one key for an uncertain or unchanged retry and freezes the fields meanwhile", () => {
    reason(render()).onChangeText("Registro duplicado");
    (render().props.onConfirm as () => void)();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0] as { idempotencyKey: string };
    expect(sent).toMatchObject({ idempotencyKey: "key-1", reason: "Registro duplicado" });

    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    const uncertain = render();
    expect(uncertain.props.phase).toBe("uncertain");
    expect(reason(uncertain).editable).toBe(false);
    const [when] = elements<{ disabled: boolean }>(uncertain.props.children, LocalDateTimeFields);
    expect(when?.props.disabled).toBe(true);
    (uncertain.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);

    Object.assign(fixture.mutation, { error: new ApiClientError("conflict", 409, "CONFLICT") });
    const failed = render();
    expect(reason(failed).editable).toBe(true);
    (failed.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
    reason(failed).onChangeText("Pago registrado dos veces");
    (render().props.onConfirm as () => void)();
    expect(fixture.mutation.mutate.mock.lastCall?.[0]).toMatchObject({ idempotencyKey: "key-3" });
  });

  test("announces the definitive result with a link to the record and closes", async () => {
    render({ linkToRecord: true });
    await fixture.mutationOptions?.onSuccess();
    expect(fixture.invalidate).toHaveBeenCalledWith({}, "business");
    const [title, options] = fixture.notify.mock.lastCall as [
      string,
      { action: { onPress: () => void }; description: string },
    ];
    expect(title).toBe("expenses.void.success");
    expect(options.description).toBe(expense.description);
    options.action.onPress();
    expect(fixture.router.push).toHaveBeenCalledWith({
      pathname: "/operate/expenses/[expenseId]",
      params: { expenseId: expense.id },
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
