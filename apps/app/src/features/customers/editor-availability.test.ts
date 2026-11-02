import { createElement } from "react";
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

import { CommandReview } from "@/components/command-review";
import type { DataTableColumn } from "@/components/ui/data-table";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { i18n } from "@/i18n/config";
import { type CommandState, commandInFlight, commandPhase } from "./command-state";

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
        disabled: stale,
        errorMessage: state.phase === "failed" ? state.message : undefined,
        items: [{ label: "Monto", value: "$1.00" }],
        note: "Revisa",
        onConfirm: noop,
        onEdit: noop,
        phase: commandPhase(state),
        title: "Revisión",
        uncertainDescription: state.phase === "uncertain" ? state.message : undefined,
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
