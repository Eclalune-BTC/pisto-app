import type { Category } from "@pisto/contracts";
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
  mutationOptions: undefined as { onSuccess: (result: unknown) => Promise<void> } | undefined,
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
  useMutation: (options: { onSuccess: (result: unknown) => Promise<void> }) => {
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

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { elements } from "../../../test-support/element-tree";
import { CategoryArchiveDialog, CategoryNameDialog } from "./category-dialogs";

type Rendered = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

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
  return CategoryNameDialog({
    businessId: "business",
    canConfirm: true,
    category: null,
    onClose,
    returnFocus: null,
    ...changes,
  }) as Rendered;
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
    expect(field(renderName()).error).toBe("catalog.categories.nameValidation");
    // Each dialog mounts with its own state, starting from the category's current name.
    fixture.states = [];
    confirmButton(renderName({ category })).onPress?.();
    expect(field(renderName({ category })).error).toBe("catalog.categories.unchangedName");
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
    await fixture.mutationOptions?.onSuccess({ category: { ...category, name: "Bebidas frías" } });
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
      onClose,
      returnFocus: null,
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
});
