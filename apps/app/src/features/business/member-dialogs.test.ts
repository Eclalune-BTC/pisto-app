import type { BusinessMember } from "@pisto/contracts";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "@/lib/api-error";

const fixture = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  focus: vi.fn(),
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
  useRef: () => ({ current: { focus: fixture.focus } }),
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
  useQueryClient: () => ({ invalidateQueries: fixture.invalidate }),
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => `00000000-0000-4000-8000-00000000000${++fixture.keys}`,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: fixture.notify } }));
vi.mock("./members-api", () => ({
  membersApi: {},
  membersQueryKey: (businessId: string) => ["business-members", businessId],
}));
vi.mock("@/components/ui/confirm-dialog", () => ({ ConfirmDialog: "confirm-dialog" }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: "dialog",
  DialogContent: "dialog-content",
  DialogDescription: "passthrough",
  DialogFooter: "dialog-footer",
  DialogHeader: "passthrough",
  DialogTitle: "passthrough",
}));

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { elements } from "../../../test-support/element-tree";
import { AddMemberDialog, ChangeRoleDialog, RemoveMemberDialog } from "./member-dialogs";

type Rendered = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
type FieldProps = { error?: string; label: string; onChangeText: (value: string) => void };
type RoleProps = { error?: string; onChange: (role: "admin" | "member") => void };

const opener = { isConnected: true, focus: vi.fn() } as unknown as HTMLElement;
const onClose = vi.fn();
const seller: BusinessMember = {
  id: "3f8c2d1e-6b7a-4c5d-9e0f-1a2b3c4d5e6f",
  name: "Ana Guzmán",
  email: "vendedor@pisto.test",
  role: "member",
};

function render<P>(Component: (props: P) => unknown, props: P): Rendered {
  fixture.index = 0;
  return Component(props) as Rendered;
}
const renderAdd = () =>
  render(AddMemberDialog, { businessId: "business", onClose, returnFocus: opener });
const renderRole = () =>
  render(ChangeRoleDialog, {
    businessId: "business",
    member: seller,
    onClose,
    returnFocus: opener,
  });

function fields(dialog: Rendered) {
  const found = new Map<string, FieldProps>();
  for (const field of elements<FieldProps>(dialog.props.children, Field)) {
    found.set(field.props.label, field.props);
  }
  const field = (label: string) => {
    const props = found.get(label);
    if (!props) throw new Error(`The ${label} field is missing.`);
    return props;
  };
  return field;
}
/** `RoleField` is private to the dialogs, so it is found by its component name. */
function roleField(dialog: Rendered): RoleProps {
  const roles: ReactElement<RoleProps>[] = [];
  const visit = (child: unknown) => {
    if (Array.isArray(child)) return child.forEach(visit);
    if (!child || typeof child !== "object" || !("props" in child)) return;
    const element = child as ReactElement<RoleProps & { children?: ReactNode }>;
    if (typeof element.type === "function" && element.type.name === "RoleField")
      roles.push(element);
    visit(element.props.children);
  };
  visit(dialog.props.children);
  const [role] = roles;
  if (!role) throw new Error("The role field is missing.");
  return role.props;
}
function confirmButton(dialog: Rendered) {
  const buttons = elements<{ label: string; onPress?: () => void }>(
    dialog.props.children,
    Button,
  ).filter((button) => button.props.label);
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

describe("add member dialog", () => {
  function fill() {
    const field = fields(renderAdd());
    field("settings.staff.name").onChangeText(" Daniela Cruz ");
    fields(renderAdd())("settings.staff.email").onChangeText(" Daniela@Example.TEST ");
    roleField(renderAdd()).onChange("admin");
    fields(renderAdd())("settings.staff.initialPassword").onChangeText("Temporal2026");
  }

  test("names every missing field inline and sends nothing", () => {
    confirmButton(renderAdd()).onPress?.();
    const dialog = renderAdd();
    const field = fields(dialog);
    expect(field("settings.staff.name").error).toBe("settings.staff.problems.nameMissing");
    expect(field("settings.staff.email").error).toBe("settings.staff.problems.emailMissing");
    expect(field("settings.staff.initialPassword").error).toBe(
      "settings.staff.problems.passwordTooShort",
    );
    expect(roleField(dialog).error).toBe("settings.staff.problems.roleMissing");
    expect(fixture.focus).toHaveBeenCalledOnce();
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
  });

  test("sends the normalized command and keeps its key until the form changes", () => {
    fill();
    confirmButton(renderAdd()).onPress?.();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0];
    expect(sent).toEqual({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      name: "Daniela Cruz",
      email: "daniela@example.test",
      role: "admin",
      initialPassword: "Temporal2026",
    });
    Object.assign(fixture.mutation, {
      error: new ApiClientError("slow down", 429, "RATE_LIMITED"),
      isError: true,
      variables: sent,
    });
    confirmButton(renderAdd()).onPress?.();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);

    Object.assign(fixture.mutation, { error: new ApiClientError("lost", 0), variables: sent });
    const uncertain = renderAdd();
    expect(confirmButton(uncertain).label).toBe("common.retrySameConfirmation");
    (uncertain.props.onOpenChange as (open: boolean) => void)(false);
    expect(onClose).not.toHaveBeenCalled();
    confirmButton(uncertain).onPress?.();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
  });

  test("shows an email that already has access as the email's own error", () => {
    fill();
    confirmButton(renderAdd()).onPress?.();
    Object.assign(fixture.mutation, {
      error: new ApiClientError("conflict", 409, "CONFLICT"),
      isError: true,
      variables: fixture.mutation.mutate.mock.lastCall?.[0],
    });
    expect(fields(renderAdd())("settings.staff.email").error).toBe(
      "settings.staff.errors.addConflict",
    );
  });

  test.each([
    ["created", 'settings.staff.addedCreated {"name":"Daniela Cruz","email":"d@example.test"}'],
    ["existing", 'settings.staff.addedExisting {"name":"Daniela Cruz"}'],
  ])("says whether the %s account needs the initial password", async (account, description) => {
    renderAdd();
    await fixture.mutationOptions?.onSuccess(
      {
        account,
        member: { id: seller.id, name: "Daniela Cruz", email: "d@example.test", role: "admin" },
      },
      { idempotencyKey: "00000000-0000-4000-8000-000000000001" },
    );
    expect(fixture.invalidate).toHaveBeenCalledWith({ queryKey: ["business-members", "business"] });
    expect(fixture.notify).toHaveBeenCalledWith("settings.staff.added", { description });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("role and removal dialogs", () => {
  test("refuses the current role and sends a different one", () => {
    confirmButton(renderRole()).onPress?.();
    expect(roleField(renderRole()).error).toBe("settings.staff.problems.sameRole");
    expect(fixture.mutation.mutate).not.toHaveBeenCalled();
    roleField(renderRole()).onChange("admin");
    confirmButton(renderRole()).onPress?.();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      role: "admin",
    });
  });

  test("removes with one key and moves focus off the removed row", async () => {
    const afterRemoval = { current: { focus: vi.fn() } };
    const renderRemove = () =>
      render(RemoveMemberDialog, {
        businessId: "business",
        businessName: "Abarrotes La Ceiba",
        member: seller,
        onClose,
        returnFocus: opener,
        returnFocusAfterRemoval: afterRemoval,
      });
    const dialog = renderRemove();
    expect(dialog.props.destructive).toBe(true);
    expect(dialog.props.returnFocus).toBe(opener);
    (dialog.props.onConfirm as () => void)();
    const sent = fixture.mutation.mutate.mock.lastCall?.[0];
    expect(sent).toEqual({ idempotencyKey: "00000000-0000-4000-8000-000000000001" });
    Object.assign(fixture.mutation, {
      error: new ApiClientError("lost", 0),
      isError: true,
      variables: sent,
    });
    (renderRemove().props.onConfirm as () => void)();
    expect(fixture.mutation.mutate).toHaveBeenLastCalledWith(sent);
    expect(fixture.keys).toBe(1);

    await fixture.mutationOptions?.onSuccess({ member: seller, replayed: false }, sent);
    expect(renderRemove().props.returnFocus).toBe(afterRemoval);
    expect(fixture.notify).toHaveBeenCalledWith("settings.staff.removed", {
      description: "Ana Guzmán",
    });
  });
});
