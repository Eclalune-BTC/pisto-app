import type { InventoryMovement, Product, ProductStock } from "@pisto/contracts";
import { ArrowRightLeft, History, PackageSearch, TriangleAlert, Undo2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/ui/row-actions";
import { StatePanel } from "@/components/ui/state-panel";
import { requireSupportedLocale } from "@/i18n/locale";
import { HeaderActions } from "../cash/header-actions";
import { type CursorPage, LoadMoreButton } from "../cash/load-more-button";
import { LowStockBadge, ProductStatusBadge } from "../catalog/catalog-cells";
import { productHref } from "../catalog/catalog-screen";
import { quantityText } from "../catalog/format";
import type { ReadState } from "../catalog/state";
import { MovementTable, movementMoment } from "./movement-table";

type ProductStockScreenProps = {
  /** Inventory management confirmed by fresh reads. */
  canManage: boolean;
  isStale: boolean;
  movements: { items: InventoryMovement[]; page: CursorPage; read: ReadState };
  onRetry: () => void;
  onRetryMovements: () => void;
  onReverse: (movement: InventoryMovement) => void;
  product: Product;
  refreshing: boolean;
  stock: ProductStock;
};

/** A movement can be reversed once; a reversal itself cannot be reversed. */
export function canReverse(movement: InventoryMovement): boolean {
  return movement.action !== "reverse" && movement.reversedByMovementId === null;
}

export function ProductStockScreen({
  canManage,
  isStale,
  movements,
  onRetry,
  onRetryMovements,
  onReverse,
  product,
  refreshing,
  stock,
}: ProductStockScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const active = product.status === "active";
  const manage = canManage && active;
  const quantity = (minorUnits: string) =>
    quantityText(t, locale, {
      minorUnits,
      precision: stock.quantityPrecision,
      unitKind: product.unitKind,
    });

  return (
    <Page>
      <PageHeader
        actions={
          <HeaderActions
            menuLabel={t("inventory.product.moreActions")}
            primary={
              manage
                ? {
                    href: {
                      pathname: "/operate/inventory/[productId]/new",
                      params: { productId: product.id },
                    },
                    icon: ArrowRightLeft,
                    label: t("inventory.product.recordMovement"),
                  }
                : undefined
            }
            secondary={[
              {
                href: productHref(product.id),
                icon: PackageSearch,
                label: t("inventory.product.viewProduct"),
              },
            ]}
          />
        }
        adornment={
          active ? (
            stock.lowStock ? (
              <LowStockBadge />
            ) : null
          ) : (
            <ProductStatusBadge status="archived" />
          )
        }
        description={active ? undefined : t("inventory.product.archivedDescription")}
        title={product.name}
      />

      {isStale ? <StaleNotice loading={refreshing} onRetry={onRetry} /> : null}

      <StatGroup>
        <Stat
          detail={stock.lowStock ? t("inventory.product.lowStockDetail") : undefined}
          label={t("inventory.product.onHand")}
          tone={stock.lowStock ? "warning" : "default"}
          value={quantity(stock.onHandMinorUnits)}
        />
        <Stat
          detail={
            stock.lowStockThresholdMinorUnits === null
              ? undefined
              : t("inventory.product.thresholdDetail")
          }
          label={t("inventory.product.threshold")}
          value={
            stock.lowStockThresholdMinorUnits === null
              ? t("inventory.product.noThreshold")
              : quantity(stock.lowStockThresholdMinorUnits)
          }
        />
      </StatGroup>

      <Section
        description={t("inventory.history.description")}
        title={t("inventory.history.title")}
      >
        {movements.read === "loading" ? (
          <ContentSkeleton label={t("inventory.history.loading")} variant="section" />
        ) : movements.read === "offline" ? (
          <OfflineState level={3} />
        ) : movements.read === "denied" ? (
          <StatePanel
            description={t("inventory.history.deniedDescription")}
            icon={TriangleAlert}
            level={3}
            title={t("inventory.history.deniedTitle")}
          />
        ) : movements.read !== "ready" ? (
          <StatePanel
            action={
              <Button
                label={t("common.retry")}
                onPress={onRetryMovements}
                size="sm"
                variant="outline"
              />
            }
            description={t("inventory.history.unavailableDescription")}
            icon={TriangleAlert}
            level={3}
            title={t("inventory.history.unavailableTitle")}
            tone="destructive"
          />
        ) : (
          <View className="min-w-0 gap-3">
            <MovementTable
              caption={t("inventory.history.title")}
              empty={
                <EmptyState
                  description={t("inventory.history.emptyDescription")}
                  icon={History}
                  title={t("inventory.history.emptyTitle")}
                />
              }
              movements={movements.items}
              product={product}
              rowActions={
                manage
                  ? (movement) =>
                      canReverse(movement) ? (
                        <RowActions
                          actions={[
                            {
                              icon: Undo2,
                              label: t("inventory.history.reverse"),
                              onPress: () => onReverse(movement),
                            },
                          ]}
                          label={t("inventory.history.rowActions", {
                            action: t(`inventory.movementActions.${movement.action}`),
                            date: movementMoment(movement, locale),
                          })}
                        />
                      ) : (
                        // Rows without a menu keep its width, so every quantity shares one edge.
                        <View aria-hidden className="size-8 native:size-10" />
                      )
                  : undefined
              }
            />
            <LoadMoreButton page={movements.page} />
          </View>
        )}
      </Section>
    </Page>
  );
}
