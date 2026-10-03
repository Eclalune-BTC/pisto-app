import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const controls = vi.hoisted(() => ({
  groups: [] as {
    value: string | undefined;
    disabled?: boolean;
    onValueChange: (value: string) => void;
  }[],
  switches: [] as {
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (value: boolean) => void;
  }[],
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: () => "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  Check: () => null,
  CheckIcon: () => null,
  ChevronDown: () => null,
  Circle: () => null,
  CircleIcon: () => null,
}));
vi.mock("@/components/ui/radio-group", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/radio-group")>();
  return {
    ...actual,
    RadioGroup: (props: ComponentProps<typeof actual.RadioGroup>) => {
      controls.groups.push(props);
      return createElement(actual.RadioGroup, props);
    },
  };
});
vi.mock("@/components/ui/switch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/switch")>();
  return {
    ...actual,
    Switch: (props: ComponentProps<typeof actual.Switch>) => {
      controls.switches.push(props);
      return createElement(actual.Switch, props);
    },
  };
});

import { MovementEditor } from "@/features/inventory/movement-editor";
import { i18n } from "@/i18n/config";
import { buildCatalogCopy } from "./copy";
import { ProductEditor } from "./product-editor";

const copy = buildCatalogCopy(i18n.t);
const noop = () => undefined;
const common = {
  errors: {},
  isStale: false,
  isRefreshing: false,
  onRetryRead: noop,
  mutationState: "idle" as const,
  onBack: noop,
  onConfirm: noop,
  onEditReview: noop,
  onResolveUncertain: noop,
  onReview: noop,
  reviewItems: null,
};
const product: ComponentProps<typeof ProductEditor> = {
  ...common,
  copy: copy.productEditor,
  categories: [],
  categoriesError: false,
  categoriesHasNextPage: false,
  categoriesLoadingMore: false,
  currency: "USD",
  mode: "create",
  onLoadMoreCategories: noop,
  onRetryCategories: noop,
  onDraftChange: noop,
  draft: {
    categoryId: null,
    lowStockThreshold: "",
    name: "Coffee",
    quantityPrecision: 0,
    sellingPrice: "2.50",
    sku: "",
    tracked: false,
    unitKind: "kilogram",
  },
};
const movement: ComponentProps<typeof MovementEditor> = {
  ...common,
  copy: copy.movementEditor,
  onDraftChange: noop,
  productName: "Coffee",
  quantityPrecision: 0,
  draft: {
    action: "receive",
    occurredLocalDate: "2026-09-27",
    occurredLocalTime: "12:00",
    quantity: "3",
    reason: "Delivery",
  },
};

beforeEach(() => {
  controls.groups.length = 0;
  controls.switches.length = 0;
});

function radios(markup: string) {
  return markup.match(/<[^>]+\brole="radio"[^>]*>/g) ?? [];
}

describe("catalog and inventory RNR controls", () => {
  test.each([0, 1, 2, 3] as const)(
    "retains precision %s, including zero, and the selected unit",
    (quantityPrecision) => {
      const onDraftChange = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(ProductEditor, {
          ...product,
          onDraftChange,
          draft: { ...product.draft, quantityPrecision },
        }),
      );
      expect(markup).toContain(copy.productEditor.unitLabels.kilogram);
      expect(radios(markup)).toHaveLength(4);
      radios(markup).forEach((radio, index) => {
        expect(radio).toContain(`aria-checked="${index === quantityPrecision}"`);
      });
      controls.groups[0]?.onValueChange("0");
      expect(onDraftChange).toHaveBeenCalledExactlyOnceWith({
        ...product.draft,
        quantityPrecision: 0,
      });
      expect(() => controls.groups[0]?.onValueChange("")).toThrow("unavailable");
      expect(onDraftChange).toHaveBeenCalledTimes(1);
    },
  );

  test.each([false, true])(
    "renders tracking checked=%s and submits the supplied boolean",
    (tracked) => {
      const onDraftChange = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(ProductEditor, {
          ...product,
          onDraftChange,
          draft: { ...product.draft, tracked },
        }),
      );
      const toggle = markup.match(/<[^>]+\brole="switch"[^>]*>/)?.[0];
      expect(toggle).toContain(`aria-checked="${tracked}"`);
      expect(toggle).toContain(`aria-label="${copy.productEditor.tracked}"`);
      controls.switches[0]?.onCheckedChange(!tracked);
      expect(onDraftChange).toHaveBeenCalledExactlyOnceWith({
        ...product.draft,
        tracked: !tracked,
      });
    },
  );

  test.each(["receive", "adjust_in", "adjust_out"] as const)(
    "retains inventory action %s and its full label",
    (action) => {
      const onDraftChange = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(MovementEditor, {
          ...movement,
          onDraftChange,
          draft: { ...movement.draft, action },
        }),
      );
      expect(radios(markup)).toHaveLength(3);
      const selected = radios(markup).filter((radio) => radio.includes('aria-checked="true"'));
      expect(selected).toHaveLength(1);
      expect(selected[0]).toContain(`aria-label="${copy.movementEditor.actions[action]}"`);
      controls.groups[0]?.onValueChange("adjust_out");
      expect(onDraftChange).toHaveBeenCalledExactlyOnceWith({
        ...movement.draft,
        action: "adjust_out",
      });
      expect(() => controls.groups[0]?.onValueChange("")).toThrow("unavailable");
      expect(onDraftChange).toHaveBeenCalledTimes(1);
    },
  );

  test.each(["pending", "uncertain"] as const)(
    "keeps controls disabled during %s",
    (mutationState) => {
      const onDraftChange = vi.fn();
      const productMarkup = renderToStaticMarkup(
        createElement(ProductEditor, { ...product, mutationState, onDraftChange }),
      );
      const movementMarkup = renderToStaticMarkup(
        createElement(MovementEditor, { ...movement, mutationState, onDraftChange }),
      );
      const renderedRadios = [...radios(productMarkup), ...radios(movementMarkup)];
      expect(renderedRadios).toHaveLength(7);
      for (const radio of renderedRadios) {
        expect(radio).toMatch(/(?:aria-disabled="true"|\sdisabled(?:="")?)/);
      }
      expect(controls.groups).toHaveLength(2);
      for (const group of controls.groups) {
        expect(group.disabled).toBe(true);
        group.onValueChange("0");
      }
      expect(controls.switches[0]?.disabled).toBe(true);
      controls.switches[0]?.onCheckedChange(true);
      expect(onDraftChange).not.toHaveBeenCalled();
    },
  );

  test("hides editable selectors while displaying a review", () => {
    const reviewItems = [{ label: "Quantity", value: "3" }];
    const markup = renderToStaticMarkup(
      createElement(MovementEditor, { ...movement, reviewItems }),
    );
    expect(radios(markup)).toHaveLength(0);
    expect(markup).toContain("Quantity");
    expect(controls.groups).toHaveLength(0);
  });
});
