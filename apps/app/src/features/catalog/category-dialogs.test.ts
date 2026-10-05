import type { Category } from "@pisto/contracts";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => void)[],
  focusName: vi.fn(),
  mutation: {
    error: null as unknown,
    isError: false,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    variables: undefined as unknown,
  },
  mutationOptions: undefined as
    | {
        onError: (error: unknown, variables: { idempotencyKey: string }) => void;
        onSuccess: (result: unknown, variables: { idempotencyKey: string }) => Promise<void>;
      }
    | undefined,
  notify: vi.fn(),
  invalidate: vi.fn(async () => undefined),
  keys: 0,
}));

vi.mock("react-native", async () => ({
  ...(await vi.importActual<Record<string, unknown>>("react-native-web")),
  useWindowDimensions: () => ({ height: 800, width: 1280 }),
}));
vi.mock("uniwind", () => ({
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#18181b") : "#18181b",
  withUniwind: (component: unknown) => component,
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => void) => fixture.effects.push(effect),
  useRef: () => ({ current: { focus: fixture.focusName } }),
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
vi.mock("./api", () => ({ catalogApi: { categories: {} } }));
vi.mock("./queries", () => ({ invalidateCatalogInventory: fixture.invalidate }));
vi.mock("@/components/ui/confirm-dialog", () => ({ ConfirmDialog: "confirm-dialog" }));
vi.mock("@/components/ui/dialog", () => {
  const passthrough = "passthrough";
  return {
    Dialog: "dialog",
    DialogContent: "dialog-content",
    DialogDescription: passthrough,
    DialogFooter: "dialog-footer",
    DialogHeader: passthrough,
    DialogTitle: passthrough,
  };
});

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { elements } from "../../../test-support/element-tree";
import { CategoryArchiveDialog, CategoryNameDialog } from "./category-dialogs";

type Rendered = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

const opener = { isConnected: true, focus: vi.fn() } as unknown as HTMLElement;
const title = { isConnected: true, focus: vi.fn() } as unknown as HTMLElement;

const category: Category = {
  id: "category-a",
  name: "Bebidas",
  status: "active",
  createdAt: "2026-09-26T12:00:00.000Z",
  updatedAt: "2026-09-26T12:00:00.000Z",
};
const onClose = vi.fn();

function renderName(changes: Partial<Parameters<typeof CategoryNameDialog>[0]> = {}) {
  fixture.index = 0;
  fixture.effects = [];
  const dialog = CategoryNameDialog({
    businessId: "business",
    canConfirm: true,
    category: null,
    focus: { opener, title },
    onClose,
    ...changes,
  }) as Rendered;
  for (const effect of fixture.effects) effect();
  return dialog;
}
function field(dialog: Rendered) {
  const [input] = elements<{
    editable: boolean;
    error?: string;
    onChangeText: (value: string) => void;
  }>(dialog.props.children, Field);
  if (!input) throw new Error("The name field is missing.");
  return input.props;
}
function confirmButton(dialog: Rendered) {
  const buttons = elements<{ label: string; onPress?: () => void; disabled?: boolean }>(
    dialog.props.children,
    Button,
  );
  const confirm = buttons.at(-1);
  if (!confirm) throw new Error("The confirm button is missing.");
  return confirm.props;
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

describe("category name dialog", () => {
  test("refuses an empty name, an unchanged rename and a lost permission without sending", () => {
    confirmButton(renderName()).onPress?.();
    expect(field(renderName()).error).toBe("catalog.categories.nameMissing");
    // A refused name takes focus back so it can be corrected right away.
    expect(fixture.focusName).toHaveBeenCalledOnce();
    // Each dialog mounts with its own state, starting from the category's current name.
    fixture.states = [];
    confirmButton(renderName({ category })).onPress?.();
    expect(field(renderName({ category })).error).toBe("catalog.categories.unchangedName");
    fixture.states = [];
    field(renderName()).onChangeText("x".repeat(81));
    confirmButton(renderName()).onPress?.();
    expect(field(renderName()).error).toBe("catalog.categories.nameTooLong");
    fixture.states = [];
    field(renderName()).onChangeText("Snacks");
    confirmButton(renderName({ canConfirm: false })).onPress?.();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    expect(confirmButton(renderName({ canConfirm: false })).disabled).toBe(true);
  });

  test("keeps one key for an uncertain retry and freezes the name meanwhile", () => {
    field(renderName()).onChangeText("  Snacks  ");
    confirmButton(renderName()).onPress?.();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0] as { idempotencyKey: string };
    expect(sent).toEqual({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      name: "Snacks",
    });

    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    const uncertain = renderName({ canConfirm: false });
    expect(field(uncertain).editable).toBe(false);
    expect(confirmButton(uncertain).label).toBe("common.retrySameConfirmation");
    expect(confirmButton(uncertain).disabled).toBe(false);
    confirmButton(uncertain).onPress?.();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
    // A locked dialog cannot be dismissed: that would discard the only key that settles it.
    (uncertain.props.onOpenChange as (open: boolean) => void)(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  test.each([
    { mode: "create", message: "catalog.categories.duplicateName" },
    { mode: "rename", message: "catalog.categories.renameConflict" },
  ] as const)(
    "shows a refused $mode as the name's own error and focuses it",
    ({ mode, message }) => {
      const changes = mode === "rename" ? { category } : {};
      field(renderName(changes)).onChangeText("Snacks");
      confirmButton(renderName(changes)).onPress?.();
      Object.assign(fixture.mutation, {
        error: new ApiClientError("conflict", 409, "CONFLICT"),
        isError: true,
        variables: fixture.mutation.mutate.mock.lastCall?.[0],
      });
      fixture.focusName.mockClear();
      const refused = renderName(changes);
      expect(field(refused).error).toBe(message);
      expect(elements(refused.props.children, Alert)).toHaveLength(0);
      expect(fixture.focusName).toHaveBeenCalled();
    },
  );

  test("states a failure that is not about the name next to the actions", () => {
    field(renderName()).onChangeText("Snacks");
    confirmButton(renderName()).onPress?.();
    Object.assign(fixture.mutation, {
      error: new ApiClientError("slow down", 429, "RATE_LIMITED"),
      isError: true,
      variables: fixture.mutation.mutate.mock.lastCall?.[0],
    });
    const refused = renderName();
    expect(field(refused).error).toBeUndefined();
    expect(elements(refused.props.children, Alert)).toHaveLength(1);
  });

  test("starts a new command once a rejected name is corrected", () => {
    field(renderName()).onChangeText("Bebidas");
    confirmButton(renderName()).onPress?.();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0];
    Object.assign(fixture.mutation, {
      error: new ApiClientError("conflict", 409, "CONFLICT"),
      isError: true,
      variables: sent,
    });
    field(renderName()).onChangeText("Bebidas frías");
    expect(fixture.mutation.reset).toHaveBeenCalledOnce();
  });

  test("announces the definitive result and closes", async () => {
    renderName({ category });
    await fixture.mutationOptions?.onSuccess(
      { category: { ...category, name: "Bebidas frías" } },
      { idempotencyKey: "00000000-0000-4000-8000-000000000001" },
    );
    expect(fixture.invalidate).toHaveBeenCalledWith({}, "business");
    expect(fixture.notify).toHaveBeenCalledWith("catalog.categories.renamed", {
      description: "Bebidas frías",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("category archive dialog", () => {
  function renderArchive(canConfirm = true) {
    fixture.index = 0;
    return CategoryArchiveDialog({
      businessId: "business",
      canConfirm,
      category,
      focus: { opener, title },
      onClose,
    }) as Rendered;
  }

  test("sends one key for every attempt and resends it after access is lost", () => {
    (renderArchive().props.onConfirm as () => void)();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0];
    expect(sent).toEqual({ idempotencyKey: "00000000-0000-4000-8000-000000000001" });
    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    const uncertain = renderArchive(false);
    expect(uncertain.props.phase).toBe("uncertain");
    (uncertain.props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
    expect(fixture.keys).toBe(1);
  });

  test("refuses a first archive without fresh access", () => {
    (renderArchive(false).props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
  });

  test("returns focus to the opener, or to the screen title once the row lost its menu", async () => {
    expect(renderArchive().props.returnFocus).toBe(opener);
    await fixture.mutationOptions?.onSuccess(
      { category: { ...category, status: "archived" } },
      { idempotencyKey: "00000000-0000-4000-8000-000000000001" },
    );
    expect(renderArchive().props.returnFocus).toBe(title);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
