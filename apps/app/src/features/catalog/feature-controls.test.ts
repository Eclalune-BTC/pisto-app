import { type ComponentProps, createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const controls = vi.hoisted(() => ({
  groups: [] as { value: string | undefined; onValueChange: (value: string) => void }[],
  filters: [] as { disabled?: boolean; value: string; onChange: (value: string) => void }[],
  selects: [] as { disabled?: boolean; label: string }[],
  switches: [] as {
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (value: boolean) => void;
  }[],
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
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
vi.mock("@/components/ui/filter-bar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/filter-bar")>();
  return {
    ...actual,
    FilterBar: (props: ComponentProps<typeof actual.FilterBar>) => {
      controls.filters.push(props);
      return createElement(actual.FilterBar, props);
    },
  };
});
vi.mock("@/components/ui/select-field", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/select-field")>();
  return {
    ...actual,
    SelectField: (props: ComponentProps<typeof actual.SelectField>) => {
      controls.selects.push(props);
      return createElement(actual.SelectField, props);
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

import { MovementFormScreen } from "@/features/inventory/movement-form-screen";
import { i18n } from "@/i18n/config";
import { ProductFormScreen } from "./product-form-screen";

const noop = () => undefined;
const common = {
  errors: {},
  isRefreshing: false,
  isStale: false,
  onCancel: noop,
  onConfirm: noop,
  onEditReview: noop,
  onRetryRead: noop,
  onReview: noop,
  phase: "idle" as const,
  reviewItems: null,
};
const product: ComponentProps<typeof ProductFormScreen> = {
  ...common,
  categories: [],
  categoriesError: false,
  categoriesLoading: false,
  currency: "USD",
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
  fieldRefs: {
    lowStockThreshold: createRef(),
    name: createRef(),
    sellingPrice: createRef(),
    sku: createRef(),
  },
  historyLocked: false,
  mode: "create",
  onDraftChange: noop,
  onRetryCategories: noop,
};
const movement: ComponentProps<typeof MovementFormScreen> = {
  ...common,
  draft: {
    action: "receive",
    occurredLocalDate: "2026-09-27",
    occurredLocalTime: "12:00",
    quantity: "3",
    reason: "Delivery",
  },
  fieldRefs: {
    occurredLocalDate: createRef(),
    occurredLocalTime: createRef(),
    quantity: createRef(),
    reason: createRef(),
  },
  onDraftChange: noop,
  onHand: "12 unidades",
  productName: "Coffee",
  quantityPrecision: 0,
};

beforeEach(() => {
  controls.groups.length = 0;
  controls.filters.length = 0;
  controls.selects.length = 0;
  controls.switches.length = 0;
});

function radios(markup: string) {
  return markup.match(/<[^>]+\brole="radio"[^>]*>/g) ?? [];
}

describe("catalog and inventory form controls", () => {
  test.each([0, 1, 2, 3] as const)(
    "keeps precision %s, including zero, and the selected unit",
    (quantityPrecision) => {
      const onDraftChange = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(ProductFormScreen, {
          ...product,
          onDraftChange,
          draft: { ...product.draft, quantityPrecision },
        }),
      );
      expect(markup).toContain(i18n.t("catalog.unitLabels.kilogram"));
      expect(radios(markup)).toHaveLength(4);
      radios(markup).forEach((radio, index) => {
        expect(radio).toContain(`aria-checked="${index === quantityPrecision}"`);
      });
      const precision = controls.filters[0];
      precision?.onChange("0");
      expect(onDraftChange).toHaveBeenCalledExactlyOnceWith({
        ...product.draft,
        quantityPrecision: 0,
      });
      expect(() => precision?.onChange("4")).toThrow("unavailable");
      expect(onDraftChange).toHaveBeenCalledTimes(1);
    },
  );

  test.each([false, true])("renders tracking checked=%s and sends the opposite", (tracked) => {
    const onDraftChange = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(ProductFormScreen, {
        ...product,
        onDraftChange,
        draft: { ...product.draft, tracked },
      }),
    );
    const toggle = markup.match(/<[^>]+\brole="switch"[^>]*>/)?.[0];
    expect(toggle).toContain(`aria-checked="${tracked}"`);
    expect(toggle).toContain(`aria-label="${i18n.t("catalog.form.tracked")}"`);
    controls.switches[0]?.onCheckedChange(!tracked);
    expect(onDraftChange).toHaveBeenCalledExactlyOnceWith({ ...product.draft, tracked: !tracked });
    // The minimum only exists for tracked stock.
    expect(markup.includes(i18n.t("catalog.form.threshold"))).toBe(tracked);
  });

  test("freezes the unit, the decimals and tracking once the product has movements", () => {
    const onDraftChange = vi.fn();
    const markup = renderToStaticMarkup(
      createElement(ProductFormScreen, {
        ...product,
        draft: { ...product.draft, tracked: true },
        historyLocked: true,
        mode: "edit",
        onDraftChange,
      }),
    );
    expect(markup).toContain(i18n.t("catalog.form.historyLocked"));
    expect(controls.switches[0]?.disabled).toBe(true);
    expect(controls.filters[0]?.disabled).toBe(true);
    const unit = controls.selects.find(({ label }) => label === i18n.t("catalog.form.unit"));
    expect(unit?.disabled).toBe(true);
    const category = controls.selects.find(
      ({ label }) => label === i18n.t("catalog.form.category"),
    );
    expect(category?.disabled).toBe(false);
    controls.switches[0]?.onCheckedChange(false);
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  test.each(["receive", "adjust_in", "adjust_out"] as const)(
    "keeps inventory action %s with its full label",
    (action) => {
      const onDraftChange = vi.fn();
      const markup = renderToStaticMarkup(
        createElement(MovementFormScreen, {
          ...movement,
          onDraftChange,
          draft: { ...movement.draft, action },
        }),
      );
      expect(radios(markup)).toHaveLength(3);
      const selected = radios(markup).filter((radio) => radio.includes('aria-checked="true"'));
      expect(selected).toHaveLength(1);
      expect(selected[0]).toContain(
        `aria-label="${i18n.t(`inventory.movementActions.${action}`)}"`,
      );
      controls.groups[0]?.onValueChange("adjust_out");
      expect(onDraftChange).toHaveBeenCalledExactlyOnceWith({
        ...movement.draft,
        action: "adjust_out",
      });
      expect(() => controls.groups[0]?.onValueChange("reverse")).toThrow("unavailable");
      expect(onDraftChange).toHaveBeenCalledTimes(1);
    },
  );

  test("states the decimals a quantity accepts", () => {
    const whole = renderToStaticMarkup(createElement(MovementFormScreen, movement));
    expect(whole).toContain(i18n.t("inventory.movementEditor.wholeNumbersHint"));
    const decimals = renderToStaticMarkup(
      createElement(MovementFormScreen, { ...movement, quantityPrecision: 2 }),
    );
    expect(decimals).toContain("Este producto acepta hasta 2 decimales.");
  });

  test("replaces every editable control with the summary while reviewing", () => {
    const reviewItems = [{ label: "Quantity", value: "+3 unidades" }];
    const movementReview = renderToStaticMarkup(
      createElement(MovementFormScreen, { ...movement, reviewItems }),
    );
    const productReview = renderToStaticMarkup(
      createElement(ProductFormScreen, { ...product, reviewItems }),
    );
    expect(radios(movementReview)).toHaveLength(0);
    expect(radios(productReview)).toHaveLength(0);
    expect(movementReview).toContain("+3 unidades");
    expect(productReview).not.toContain('role="switch"');
    expect(controls.groups).toHaveLength(0);
    expect(controls.filters).toHaveLength(0);
  });
});
