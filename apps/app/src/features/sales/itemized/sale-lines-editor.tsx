import { Minus, Plus, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { quantityText } from "@/features/catalog/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";
import { lineIssueMessage } from "./issue-copy";
import {
  type ItemizedLineDraft,
  type LineIssue,
  lineAmounts,
  stepQuantity,
} from "./itemized-draft";

type SaleLinesEditorProps = {
  currency: string;
  currencyDigits: number;
  disabled: boolean;
  /** Field issues are shown once the person tried to save; a stock shortfall always shows. */
  issues: Record<string, LineIssue> | null;
  lines: readonly ItemizedLineDraft[];
  onChange: (
    productId: string,
    change: Partial<Pick<ItemizedLineDraft, "quantity" | "unitPrice">>,
  ) => void;
  onRemove: (productId: string) => void;
  wide: boolean;
};

function StockHint({ line, short }: { line: ItemizedLineDraft; short: boolean }) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  if (!line.stock) return null;
  const quantity = quantityText(t, locale, {
    minorUnits: line.stock.onHandMinorUnits,
    precision: line.stock.quantityPrecision,
    unitKind: line.product.unitKind,
  });
  return (
    <Text
      className={cn(
        "text-xs leading-4 tabular-nums",
        short ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {short
        ? t("sales.itemized.stockShort", { quantity })
        : t("sales.itemized.stockLeft", { quantity })}
    </Text>
  );
}

function QuantityStepper({
  disabled,
  line,
  onChange,
  invalid,
}: {
  disabled: boolean;
  invalid: boolean;
  line: ItemizedLineDraft;
  onChange: (quantity: string) => void;
}) {
  const { t } = useTranslation();
  const name = line.product.name;
  return (
    <View className="flex-row items-center gap-1">
      <Button
        accessibilityLabel={t("sales.itemized.decrease", { product: name })}
        disabled={disabled}
        onPress={() => onChange(stepQuantity(line, -1))}
        size="icon-sm"
        variant="outline"
      >
        <Icon as={Minus} size={14} />
      </Button>
      <Input
        accessibilityLabel={t("sales.itemized.quantityOf", { product: name })}
        aria-invalid={invalid}
        className="w-16 text-center tabular-nums"
        editable={!disabled}
        inputMode={line.product.quantityPrecision === 0 ? "numeric" : "decimal"}
        keyboardType={line.product.quantityPrecision === 0 ? "number-pad" : "decimal-pad"}
        onChangeText={onChange}
        selectTextOnFocus
        value={line.quantity}
      />
      <Button
        accessibilityLabel={t("sales.itemized.increase", { product: name })}
        disabled={disabled}
        onPress={() => onChange(stepQuantity(line, 1))}
        size="icon-sm"
        variant="outline"
      >
        <Icon as={Plus} size={14} />
      </Button>
    </View>
  );
}

/** The product lines of a sale: quantity, price and the exact subtotal the server will charge. */
export function SaleLinesEditor({
  currency,
  currencyDigits,
  disabled,
  issues,
  lines,
  onChange,
  onRemove,
  wide,
}: SaleLinesEditorProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  if (lines.length === 0) {
    return (
      <Text className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
        {t("sales.itemized.noLines")}
      </Text>
    );
  }
  return (
    <View className="min-w-0 overflow-hidden rounded-md border border-border bg-card">
      {wide ? (
        <View
          aria-hidden
          className="flex-row items-center gap-3 border-b border-border bg-muted/40 px-3 py-2"
        >
          <Text className="min-w-0 flex-1 text-xs text-muted-foreground">
            {t("sales.itemized.columns.product")}
          </Text>
          <Text className="w-[136px] text-xs text-muted-foreground">
            {t("sales.itemized.columns.quantity")}
          </Text>
          <Text className="w-24 text-xs text-muted-foreground">
            {t("sales.itemized.columns.price")}
          </Text>
          <Text className="w-24 text-right text-xs text-muted-foreground">
            {t("sales.itemized.columns.subtotal")}
          </Text>
          <View className="w-8" />
        </View>
      ) : null}
      {lines.map((line, index) => {
        const amounts = lineAmounts(line, currencyDigits);
        const shortOfStock = amounts.issue === "stock";
        const issue = issues?.[line.product.id] ?? (shortOfStock ? "stock" : undefined);
        const message =
          issue && issue !== "stock"
            ? lineIssueMessage(t, issue, line.product.quantityPrecision)
            : null;
        const priceInvalid = issue === "price-required" || issue === "price-invalid";
        const quantityInvalid = Boolean(issue) && !priceInvalid;
        const subtotal =
          amounts.subtotalMinorUnits === null
            ? "—"
            : formatMinorUnits(amounts.subtotalMinorUnits, currency, currencyDigits, locale);
        const name = line.product.name;
        const price = (
          <Input
            accessibilityLabel={t("sales.itemized.priceOf", { product: name })}
            aria-invalid={priceInvalid}
            className={cn("tabular-nums", wide ? "w-24" : "w-28")}
            editable={!disabled}
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={(unitPrice) => onChange(line.product.id, { unitPrice })}
            placeholder={t("sales.itemized.noPrice")}
            selectTextOnFocus
            value={line.unitPrice}
          />
        );
        const remove = (
          <Button
            accessibilityLabel={t("sales.itemized.remove", { product: name })}
            disabled={disabled}
            onPress={() => onRemove(line.product.id)}
            size="icon-sm"
            variant="ghost"
          >
            <Icon as={Trash2} className="text-muted-foreground" size={15} />
          </Button>
        );
        const stepper = (
          <QuantityStepper
            disabled={disabled}
            invalid={quantityInvalid}
            line={line}
            onChange={(quantity) => onChange(line.product.id, { quantity })}
          />
        );
        return (
          <View
            className={cn("gap-1.5 px-3 py-2.5", index > 0 && "border-t border-border")}
            key={line.product.id}
          >
            {wide ? (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm leading-5" numberOfLines={2}>
                    {name}
                  </Text>
                  <StockHint line={line} short={shortOfStock} />
                </View>
                <View className="w-[136px]">{stepper}</View>
                {price}
                <Text className="w-24 text-right font-ui text-sm tabular-nums">{subtotal}</Text>
                {remove}
              </View>
            ) : (
              <>
                <View className="flex-row items-start gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm leading-5" numberOfLines={2}>
                      {name}
                    </Text>
                    <StockHint line={line} short={shortOfStock} />
                  </View>
                  <Text className="font-ui text-sm tabular-nums">{subtotal}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {stepper}
                  {price}
                  <View className="flex-1" />
                  {remove}
                </View>
              </>
            )}
            {message ? (
              <Text accessibilityRole="alert" className="text-[13px] leading-5 text-destructive">
                {message}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
