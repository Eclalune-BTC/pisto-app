import type { RecordInventoryMovementRequest } from "@pisto/contracts";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  Check: () => null,
}));

import { Button } from "@/components/ui/button";
import "@/i18n/config";
import { buildMovementCommand } from "./movement-draft";
import {
  type InventoryMovementDraft,
  MovementEditor,
  type MovementEditorCopy,
} from "./movement-editor";

const copy: MovementEditorCopy = {
  back: "Back",
  title: "Movement",
  description: "Record movement",
  reviewTitle: "Review",
  reviewDescription: "Review movement",
  actions: { receive: "Receive", adjust_in: "Add", adjust_out: "Remove" },
  actionLabel: "Action",
  quantity: "Quantity",
  quantityPlaceholder: "1",
  reason: "Reason",
  reasonPlaceholder: "Delivery",
  date: "Date",
  datePlaceholder: "YYYY-MM-DD",
  time: "Time",
  timePlaceholder: "HH:mm",
  precisionHint: String,
  review: "Review movement",
  edit: "Edit",
  confirm: "Confirm",
  failedTitle: "Failed",
  failedDescription: "Try again",
  uncertainTitle: "Uncertain",
  uncertainDescription: "The result could not be verified",
  retrySameConfirmation: "Retry the same confirmation",
};
const draft: InventoryMovementDraft = {
  action: "receive",
  occurredLocalDate: "2026-09-10",
  occurredLocalTime: "12:00",
  quantity: "5",
  reason: "Delivery",
};

function buttons(node: ReactNode): ReactElement<ComponentProps<typeof Button>>[] {
  const result: ReactElement<ComponentProps<typeof Button>>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === Button) result.push(child as ReactElement<ComponentProps<typeof Button>>);
    result.push(...buttons(child.props.children));
  });
  return result;
}

describe("reviewed inventory confirmation", () => {
  test("cannot discard or resubmit a pending command and retries uncertainty with the original key", async () => {
    const client = new QueryClient();
    const requests: {
      command: RecordInventoryMovementRequest;
      reject: (error: Error) => void;
      resolve: () => void;
    }[] = [];
    const observer = new MutationObserver(client, {
      mutationFn: (command: RecordInventoryMovementRequest) =>
        new Promise<void>((resolve, reject) => requests.push({ command, reject, resolve })),
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const reset = vi.spyOn(observer, "reset");
    const result = buildMovementCommand({
      draft,
      idempotencyKey: "10000000-0000-4000-8000-000000000001",
      quantityPrecision: 0,
    });
    if (!("command" in result)) throw new Error("Invalid test draft");
    let command: RecordInventoryMovementRequest | null = result.command;
    const originalCommand = command;
    let attempt: Promise<void> | undefined;
    const discard = vi.fn(() => {
      command = null;
      observer.reset();
    });
    const prepareAnotherReview = vi.fn();
    const submit = () => {
      if (command) attempt = observer.mutate(command).catch(() => undefined);
    };
    const render = () => {
      const mutation = observer.getCurrentResult();
      return MovementEditor({
        copy,
        draft,
        errors: {},
        mutationState: mutation.isPending ? "pending" : mutation.isError ? "uncertain" : "idle",
        onBack: discard,
        onConfirm: submit,
        onDraftChange: vi.fn(),
        onEditReview: discard,
        onResolveUncertain: submit,
        onReview: prepareAnotherReview,
        productName: "Coffee",
        quantityPrecision: 0,
        reviewItems: command ? [{ label: "Quantity", value: "5" }] : null,
      });
    };

    const confirm = buttons(render()).find((button) => button.props.variant === "accent");
    (confirm?.props.onPress as (() => void) | undefined)?.();
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    const pending = render();
    const pendingButtons = buttons(pending);
    expect(pendingButtons).toHaveLength(3);
    for (const button of pendingButtons) {
      expect(button.props.disabled || button.props.loading).toBe(true);
      expect(button.props.onPress).toBeUndefined();
    }
    const markup = renderToStaticMarkup(pending);
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(3);
    expect(discard).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(prepareAnotherReview).not.toHaveBeenCalled();
    expect(observer.getCurrentResult().variables).toBe(originalCommand);
    expect(command).toBe(originalCommand);

    requests[0]?.reject(new Error("The response was lost after dispatch"));
    await attempt;
    const uncertainButtons = buttons(render());
    expect(uncertainButtons.find((button) => button.props.label === copy.edit)).toBeUndefined();
    expect(uncertainButtons[0]?.props.disabled).toBe(true);
    expect(uncertainButtons[0]?.props.onPress).toBeUndefined();
    const retry = uncertainButtons.find(
      (button) => button.props.label === copy.retrySameConfirmation,
    );
    expect(retry).toBeDefined();
    (retry?.props.onPress as (() => void) | undefined)?.();
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]?.command).toBe(originalCommand);
    expect(requests[1]?.command.idempotencyKey).toBe(requests[0]?.command.idempotencyKey);
    requests[1]?.resolve();
    await attempt;
    expect(observer.getCurrentResult().isSuccess).toBe(true);
    expect(reset).not.toHaveBeenCalled();
    unsubscribe();
    client.clear();
  });
});
