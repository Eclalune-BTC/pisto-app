import type { Product, ProductStock } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { quantityText } from "./format";

/** An absent optional value: a dash on screen and its meaning for screen readers. */
export function MissingValue({ label }: { label: string }) {
  return (
    <View className="min-w-0">
      <Text aria-hidden className="text-[13px] text-muted-foreground">
        —
      </Text>
      <Text className="sr-only">{label}</Text>
    </View>
  );
}

/** Archived is the exception, so it carries the stronger chip; active is the quiet default. */
export function ProductStatusBadge({ status }: { status: Product["status"] }) {
  const { t } = useTranslation();
  return (
    <Badge
      // Secondary alone sits too close to the row surface; this keeps 1.5:1 in both themes.
      className={status === "archived" ? "bg-foreground/20" : undefined}
      variant={status === "archived" ? "secondary" : "outline"}
    >
      <Text>{t(`catalog.status.${status}`)}</Text>
    </Badge>
  );
}

export function LowStockBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="warning">
      <Text>{t("catalog.list.lowStock")}</Text>
    </Badge>
  );
}

/** A product's category by name; a name not read yet is a placeholder, never a guess. */
export function CategoryName({
  categoryId,
  loading,
  names,
}: {
  categoryId: string | null;
  loading: boolean;
  names: ReadonlyMap<string, string>;
}) {
  const { t } = useTranslation();
  if (categoryId === null) return <MissingValue label={t("catalog.list.noCategory")} />;
  const name = names.get(categoryId);
  if (name) {
    return (
      <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
        {name}
      </Text>
    );
  }
  if (loading) return <Skeleton className="h-3 w-20" />;
  return <MissingValue label={t("catalog.list.categoryUnavailable")} />;
}

/** The derived on-hand balance with its unit; untracked products have none to show. */
export function StockValue({ product, stock }: { product: Product; stock: ProductStock | null }) {
  const { i18n, t } = useTranslation();
  if (!stock) {
    return (
      <Text className="text-[13px] text-muted-foreground">{t("catalog.list.notTracked")}</Text>
    );
  }
  return (
    <View className="min-w-0 flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {stock.lowStock ? <LowStockBadge /> : null}
      <Text className="font-ui text-[13px] tabular-nums">
        {quantityText(t, requireSupportedLocale(i18n.resolvedLanguage), {
          minorUnits: stock.onHandMinorUnits,
          precision: stock.quantityPrecision,
          unitKind: product.unitKind,
        })}
      </Text>
    </View>
  );
}
