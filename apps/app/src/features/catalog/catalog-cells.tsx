import type { Product, ProductStock } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { CellText } from "@/components/ui/cell-text";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { quantityText } from "./format";

/** Stands in for an absent value; the label or detail next to it says what is missing. */
export const EMPTY_VALUE = "—";

/**
 * An absent optional value: a dash on screen and its meaning for screen readers. It is one line of
 * text, so it follows the alignment of its column.
 */
export function MissingValue({ label }: { label: string }) {
  return (
    <Text accessibilityLabel={label} className="text-[13px] text-muted-foreground">
      {EMPTY_VALUE}
    </Text>
  );
}

export function ProductStatusBadge({ status }: { status: Product["status"] }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      label={t(`catalog.status.${status}`)}
      tone={status === "archived" ? "exception" : "normal"}
    />
  );
}

/** Low stock needs attention; tables use the short label because their column names the stock. */
export function LowStockBadge({ short = false }: { short?: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusBadge
      label={short ? t("catalog.list.lowStockShort") : t("catalog.list.lowStock")}
      tone="attention"
    />
  );
}

/** A product's category as read for its row: still loading, unreadable, absent or named. */
export type CategoryCell =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "none" }
  | { kind: "named"; name: string };

export function categoryCell(
  categoryId: string | null,
  choices: { complete: boolean; failed: boolean; names: ReadonlyMap<string, string> },
): CategoryCell {
  if (categoryId === null) return { kind: "none" };
  const name = choices.names.get(categoryId);
  if (name) return { kind: "named", name };
  return choices.complete || choices.failed ? { kind: "unavailable" } : { kind: "loading" };
}

/** A product's category by name; a name not read yet is a placeholder, never a guess. */
export function CategoryName({ cell }: { cell: CategoryCell }) {
  const { t } = useTranslation();
  if (cell.kind === "named") {
    return (
      <CellText className="text-muted-foreground" maxWidth="max-w-[11rem]">
        {cell.name}
      </CellText>
    );
  }
  if (cell.kind === "loading") return <Skeleton className="h-3 w-20" />;
  return (
    <MissingValue
      label={
        cell.kind === "none" ? t("catalog.list.noCategory") : t("catalog.list.categoryUnavailable")
      }
    />
  );
}

/**
 * The derived on-hand balance with its unit. Untracked products have none to show, and an archived
 * product is out of operation, so its balance asks for no attention.
 */
export function StockValue({ product, stock }: { product: Product; stock: ProductStock | null }) {
  const { i18n, t } = useTranslation();
  if (!stock) {
    return (
      <Text className="text-[13px] text-muted-foreground">{t("catalog.list.notTracked")}</Text>
    );
  }
  return (
    <View className="min-w-0 flex-row items-center justify-end gap-2">
      {stock.lowStock && product.status === "active" ? <LowStockBadge short /> : null}
      <Text className="font-ui text-[13px] tabular-nums" numberOfLines={1}>
        {quantityText(t, requireSupportedLocale(i18n.resolvedLanguage), {
          minorUnits: stock.onHandMinorUnits,
          precision: stock.quantityPrecision,
          unitKind: product.unitKind,
        })}
      </Text>
    </View>
  );
}
