import type { Business, Receivable } from "@pisto/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "50000000-0000-4000-8000-000000000001" }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({
  apiRequest: vi.fn(),
  parseRequestPayload: (schema: { parse: (payload: unknown) => unknown }, payload: unknown) =>
    schema.parse(payload),
  pathWithQuery: (path: string) => path,
}));

import type { DataTableColumn } from "@/components/ui/data-table";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { PaymentEditor } from "@/features/receivables/payment-editor";
import { i18n } from "@/i18n/config";
import { CommandReview } from "./command-review";
import { type CommandState, commandInFlight } from "./command-state";

const noop = () => undefined;

function column(id: string): DataTableColumn<unknown> {
  return { cell: () => null, header: id, id };
}

describe("columns fitted to the table container", () => {
  const entries: FittedColumn<unknown>[] = [
    { column: column("name"), estimate: 200 },
    { column: column("email"), dropRank: 0, estimate: 250, only: "table" },
    { column: column("phone"), dropRank: 1, estimate: 130 },
    { column: column("detail"), estimate: 100, only: "compact" },
    { column: column("balance"), estimate: 100 },
  ];
  const ids = (width: number, compact?: boolean) =>
    fitColumns(entries, width, compact).map((entry) => entry.id);

  test("keeps every table column that fits", () => {
    expect(ids(1000)).toEqual(["name", "email", "phone", "balance"]);
  });

  test("drops optional columns by rank instead of clipping the rest", () => {
    expect(ids(600, false)).toEqual(["name", "phone", "balance"]);
    expect(ids(400, false)).toEqual(["name", "balance"]);
  });

  test("compact records keep their own columns whatever the width", () => {
    expect(ids(320)).toEqual(["name", "phone", "detail", "balance"]);
    expect(ids(1000, true)).toEqual(["name", "phone", "detail", "balance"]);
  });
});

describe("commands that may have reached the server", () => {
  test("keep their review while pending, uncertain or confirmed", () => {
    const states: [CommandState, boolean][] = [
      [{ phase: "idle" }, false],
      [{ phase: "failed", message: "Rejected" }, false],
      [{ phase: "pending" }, true],
      [{ phase: "uncertain", message: "Lost" }, true],
      [{ phase: "confirmed" }, true],
    ];
    for (const [state, expected] of states) expect(commandInFlight(state)).toBe(expected);
  });
});

describe("reviews on stale reads", () => {
  const review = (state: CommandState, stale: boolean) =>
    renderToStaticMarkup(
      createElement(CommandReview, {
        confirmLabel: "Confirmar cargo",
        description: "Revisa",
        items: [{ label: "Monto", value: "$1.00" }],
        onConfirm: noop,
        onEdit: noop,
        stale,
        state,
        title: "Revisión",
      }),
    );

  test("block a first send but never the retry of an uncertain command", () => {
    expect(review({ phase: "idle" }, true)).toContain('aria-disabled="true"');
    expect(review({ phase: "failed", message: "Rejected" }, true)).toContain(
      'aria-disabled="true"',
    );
    expect(review({ phase: "idle" }, false)).not.toContain('aria-disabled="true"');
    const uncertain = review({ phase: "uncertain", message: "Lost" }, true);
    expect(uncertain).toContain(i18n.t("common.retrySameConfirmation"));
    expect(uncertain).not.toContain('aria-disabled="true"');
  });
});

describe("payment editor availability", () => {
  const business = {
    id: "business-a",
    currency: "USD",
    currencyMinorUnitDigits: 2,
    timeZone: "America/El_Salvador",
  } as Business;
  const receivable: Receivable = {
    id: "60000000-0000-4000-8000-000000000001",
    customerId: "60000000-0000-4000-8000-000000000002",
    state: "open",
    originalMinorUnits: "2500",
    paidMinorUnits: "0",
    outstandingMinorUnits: "2500",
    currency: "USD",
    currencyMinorUnitDigits: 2,
    description: "Pedido de septiembre",
    postedDate: "2026-09-01",
    dueDate: null,
    voidedAt: null,
    voidReason: null,
    createdAt: "2026-09-27T18:00:00.000Z",
    updatedAt: "2026-09-27T18:00:00.000Z",
  };
  const editor = (availability: ComponentProps<typeof PaymentEditor>["availability"]) =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(PaymentEditor, {
          availability,
          business,
          cancelHref: "/operate/receivables",
          customerName: "Ana",
          onConfirmed: noop,
          onRetryRead: noop,
          receivable,
        }),
      ),
    );

  test("closes when the receivable no longer accepts a payment", () => {
    const markup = editor("unavailable");
    expect(markup).toContain(i18n.t("relationships.common.actionUnavailableTitle"));
    expect(markup).not.toContain(i18n.t("receivables.payment.review"));
  });

  test("keeps the form on stale reads but waits for a fresh read to review", () => {
    const stale = editor("stale");
    expect(stale).toContain(i18n.t("remote.stale"));
    expect(stale).toContain(i18n.t("receivables.payment.review"));
    expect(stale).toContain('aria-disabled="true"');
    expect(editor("available")).not.toContain('aria-disabled="true"');
  });
});
