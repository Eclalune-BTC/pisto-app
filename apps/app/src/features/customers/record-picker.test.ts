import type { Customer } from "@pisto/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const captured = vi.hoisted(() => ({ picker: undefined as Record<string, unknown> | undefined }));
vi.mock("./record-picker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./record-picker")>()),
  RecordPicker: (props: Record<string, unknown>) => {
    captured.picker = props;
    return null;
  },
}));
const listCustomers = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ customersApi: { list: listCustomers } }));

import { ScrollView } from "react-native";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { elements } from "../../../test-support/element-tree";
import { CustomerPickerDialog } from "./customer-picker";
import { customerQueryKeys } from "./queries";
import { RecordPickerList, type RecordPickerListProps } from "./record-picker";

type Choice = { id: string; name: string };

const choices: Choice[] = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Luis" },
];

function list(overrides: Partial<RecordPickerListProps<Choice>> = {}) {
  return RecordPickerList<Choice>({
    emptyText: "No customers",
    freshChoiceOnly: true,
    getKey: (choice) => choice.id,
    hasNextPage: true,
    items: choices,
    label: "Customers",
    loadMoreLabel: "Load more",
    loadingMore: false,
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    renderItem: (choice) => ({ label: choice.name }),
    selectedKey: "b",
    stale: false,
    status: "ready",
    ...overrides,
  });
}

describe("record picker list", () => {
  test("keeps the server cursor inside the scrolling list and loads the next page in place", () => {
    const onLoadMore = vi.fn();
    const onSelect = vi.fn();
    const tree = list({ onLoadMore, onSelect });
    const [scroll] = elements(tree, ScrollView);
    const loadMore = elements<ComponentProps<typeof Button>>(scroll, Button).find(
      (button) => button.props.label === "Load more",
    );
    expect(loadMore?.props.loading).toBe(false);
    loadMore?.props.onPress?.({} as never);
    expect(onLoadMore).toHaveBeenCalledOnce();

    const options = elements<ComponentProps<typeof PressableSurface>>(tree, PressableSurface);
    expect(options.map((option) => option.props.accessibilityState)).toEqual([
      { checked: false, disabled: false },
      { checked: true, disabled: false },
    ]);
    options[0]?.props.onPress?.({} as never);
    expect(onSelect).toHaveBeenCalledWith(choices[0]);
  });

  test("marks the next page busy and offers no cursor after the last page", () => {
    const busy = elements<ComponentProps<typeof Button>>(list({ loadingMore: true }), Button);
    expect(busy.find((button) => button.props.label === "Load more")?.props.loading).toBe(true);
    const last = elements<ComponentProps<typeof Button>>(list({ hasNextPage: false }), Button);
    expect(last.some((button) => button.props.label === "Load more")).toBe(false);
  });

  test("keeps a failed read retryable instead of presenting it as no choices", () => {
    const onRetry = vi.fn();
    const failed = renderToStaticMarkup(list({ onRetry, status: "error" }));
    expect(failed).toContain("relationships.picker.unavailable");
    expect(failed).not.toContain("No customers");
    const [retry] = elements<ComponentProps<typeof Button>>(
      list({ onRetry, status: "error" }),
      Button,
    );
    retry?.props.onPress?.({} as never);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(list({ items: [] }))).toContain("No customers");
  });

  test("offers no choice for a command from a list that could not be refreshed", () => {
    const onRetry = vi.fn();
    const stale = list({ onRetry, stale: true });
    const [notice] = elements<NonNullable<ComponentProps<typeof StaleNotice>>>(stale, StaleNotice);
    expect(notice?.props.onRetry).toBe(onRetry);
    const options = elements<ComponentProps<typeof PressableSurface>>(stale, PressableSurface);
    expect(options.every((option) => option.props.disabled === true)).toBe(true);
    // A filter only narrows a read, so its cached choices stay selectable next to the notice.
    const filter = list({ freshChoiceOnly: false, stale: true });
    expect(elements(filter, StaleNotice)).toHaveLength(1);
    expect(
      elements<ComponentProps<typeof PressableSurface>>(filter, PressableSurface).some(
        (option) => option.props.disabled,
      ),
    ).toBe(false);
  });
});

describe("customer picker dialog", () => {
  beforeEach(() => {
    captured.picker = undefined;
    listCustomers.mockReset();
  });

  test("offers every loaded page and fetches the next one with the server cursor", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const customer = (id: string, name: string): Customer => ({
      id,
      name,
      phone: "2222-3333",
      email: null,
      notes: null,
      status: "active",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
    });
    client.setQueryData(customerQueryKeys.list("business-a", { status: "active" }), {
      pageParams: [null],
      pages: [{ items: [customer("c1", "Ana")], nextCursor: "cursor-2" }],
    });
    listCustomers.mockResolvedValue({ items: [customer("c2", "Luis")], nextCursor: null });
    const render = () =>
      renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client },
          createElement(CustomerPickerDialog, {
            businessId: "business-a",
            freshChoiceOnly: true,
            onOpenChange: vi.fn(),
            onSelect: vi.fn(),
            open: true,
            selectedId: null,
            status: "active",
          }),
        ),
      );

    const picker = () => {
      if (!captured.picker) throw new Error("The customer picker was not rendered");
      return captured.picker as { hasNextPage: boolean; items: Customer[]; onLoadMore: () => void };
    };

    render();
    expect(captured.picker).toMatchObject({ hasNextPage: true, stale: false, status: "ready" });
    expect(picker().items.map(({ name }) => name)).toEqual(["Ana"]);
    picker().onLoadMore();
    await vi.waitFor(() => expect(listCustomers).toHaveBeenCalledOnce());
    expect(listCustomers.mock.calls[0]?.[0]).toMatchObject({
      cursor: "cursor-2",
      status: "active",
    });
    await vi.waitFor(() =>
      expect(
        client.getQueryData<{ pages: unknown[] }>(
          customerQueryKeys.list("business-a", { status: "active" }),
        )?.pages,
      ).toHaveLength(2),
    );
    render();
    expect(picker().items.map(({ name }) => name)).toEqual(["Ana", "Luis"]);
    expect(picker().hasNextPage).toBe(false);
    client.clear();
  });
});
