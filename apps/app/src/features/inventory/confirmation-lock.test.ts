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
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  // The review is rendered as a plain function here; its focus effect needs no element.
  useEffect: () => undefined,
  useRef: (initial: unknown) => ({ current: initial }),
}));

import { CommandReview } from "@/components/command-review";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-error";
import { keyedCommandPhase } from "@/lib/keyed-command";
import { buildMovementCommand } from "./movement-draft";

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
  test("locks the review while pending and resends the original command after an unknown outcome", async () => {
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
      draft: {
        action: "receive",
        occurredLocalDate: "2026-09-10",
        occurredLocalTime: "12:00",
        quantity: "5",
        reason: "Delivery",
      },
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
    const submit = () => {
      if (command) attempt = observer.mutate(command).catch(() => undefined);
    };
    const render = () => {
      return CommandReview({
        confirmLabel: "Confirm",
        failedTitle: "Failed",
        items: [{ label: "Quantity", value: "+5 unidades" }],
        onConfirm: submit,
        onEdit: discard,
        phase: keyedCommandPhase(observer.getCurrentResult(), null),
        title: "Review",
        uncertainDescription: "Retry the same confirmation",
      });
    };

    const confirm = buttons(render()).find((button) => button.props.label === "Confirm");
    (confirm?.props.onPress as (() => void) | undefined)?.();
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    const pending = render();
    const pendingButtons = buttons(pending);
    expect(pendingButtons).toHaveLength(2);
    for (const button of pendingButtons) {
      expect(button.props.disabled || button.props.loading).toBe(true);
      expect(button.props.onPress).toBeUndefined();
    }
    const markup = renderToStaticMarkup(pending);
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(discard).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
    expect(observer.getCurrentResult().variables).toBe(originalCommand);

    // A lost response is not an answer from the server: the outcome is unknown.
    requests[0]?.reject(new ApiClientError("The response was lost after dispatch", 0));
    await attempt;
    const uncertain = render();
    const uncertainButtons = buttons(uncertain);
    expect(uncertainButtons).toHaveLength(1);
    expect(renderToStaticMarkup(uncertain)).toContain("Retry the same confirmation");
    const retry = uncertainButtons[0];
    expect(retry?.props.label).toBe("common.retrySameConfirmation");
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
