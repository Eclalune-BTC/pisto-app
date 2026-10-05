import type { InventoryMovement, ProductDetail } from "@pisto/contracts";
import { Link } from "expo-router";
import {
  Archive,
  ArrowRight,
  ArrowRightLeft,
  History,
  Pencil,
  TriangleAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { type HeaderAction, HeaderActions } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { MutedValue } from "@/components/layout/review-values";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import type { MutationPhase } from "@/lib/mutation-phase";
import { newMovementHref, stockHref } from "../inventory/inventory-screen";
import { MovementTable } from "../inventory/movement-table";
import { EMPTY_VALUE, ProductStatusBadge } from "./catalog-cells";
import { productPrice, quantityText } from "./format";
import type { ReadState } from "./state";

const RECENT_MOVEMENTS = 5;

export type ArchiveDialogState = {
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onOpen: () => void;
  open: boolean;
  phase: MutationPhase;
  /** Where focus goes when the dialog closes. */
  returnFocus: HTMLElement | null;
};

type ProductDetailScreenProps = {
  archive: ArchiveDialogState;
  /** The role may manage the catalog; a stale read still blocks a new archive. */
  canManage: boolean;
  /** The role may record inventory movements. */
  canRecordMovement: boolean;
  /** Undefined while the category name is still being read. */
  categoryName: string | null | undefined;
  detail: ProductDetail;
  isStale: boolean;
  /** Null when the role cannot read inventory or the product does not track stock. */
  movements: { items: InventoryMovement[]; read: ReadState } | null;
  onRetry: () => void;
  onRetryMovements: () => void;
  refreshing: boolean;
  timeZone: string;
};

export function ProductDetailScreen({
  archive,
  canManage,
  canRecordMovement,
  categoryName,
  detail,
  isStale,
  movements,
  onRetry,
  onRetryMovements,
  refreshing,
  timeZone,
}: ProductDetailScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const { product, stock } = detail;
  const active = product.status === "active";
  const price = productPrice(product, locale);
  const quantity = (minorUnits: string, precision: number) =>
    quantityText(t, locale, { minorUnits, precision, unitKind: product.unitKind });
  const edit: HeaderAction = {
    href: { pathname: "/operate/catalog/[productId]/edit", params: { productId: product.id } },
    icon: Pencil,
    label: t("catalog.detail.edit"),
  };
  const record: HeaderAction | undefined =
    canRecordMovement && active && stock
      ? {
          href: newMovementHref(product.id),
          icon: ArrowRightLeft,
          label: t("inventory.product.recordMovement"),
        }
      : undefined;
  const manage = canManage && active;
  // An archived product is out of operation, so its balance asks for no attention.
  const lowStock = active && stock?.lowStock === true;
  const priceStat = (
    <Stat
      detail={price === null ? t("catalog.detail.noPrice") : undefined}
      label={t("catalog.detail.price")}
      value={price ?? EMPTY_VALUE}
    />
  );

  return (
    <Page>
      <PageHeader
        actions={
          manage || record ? (
            <HeaderActions
              menuLabel={t("catalog.detail.moreActions")}
              overflow={
                manage
                  ? [
                      {
                        destructive: true,
                        icon: Archive,
                        label: t("catalog.detail.archive"),
                        onPress: archive.onOpen,
                      },
                    ]
                  : []
              }
              primary={record ?? (manage ? edit : undefined)}
              secondary={record && manage ? [edit] : []}
            />
          ) : undefined
        }
        adornment={<ProductStatusBadge status={product.status} />}
        description={active ? undefined : t("catalog.detail.archivedDescription")}
        title={product.name}
      />

      {isStale ? <StaleNotice loading={refreshing} onRetry={onRetry} /> : null}

      {/* An untracked product has no balance or minimum; its details say it is not tracked. */}
      {stock ? (
        <StatGroup>
          {priceStat}
          <Stat
            detail={lowStock ? t("catalog.detail.lowStockDetail") : undefined}
            label={t("catalog.detail.onHand")}
            tone={lowStock ? "warning" : "default"}
            value={quantity(stock.onHandMinorUnits, stock.quantityPrecision)}
          />
          <Stat
            detail={
              stock.lowStockThresholdMinorUnits === null
                ? t("catalog.detail.noThreshold")
                : t("catalog.detail.thresholdDetail")
            }
            label={t("catalog.detail.threshold")}
            value={
              stock.lowStockThresholdMinorUnits === null
                ? EMPTY_VALUE
                : quantity(stock.lowStockThresholdMinorUnits, stock.quantityPrecision)
            }
          />
        </StatGroup>
      ) : (
        <StatGroup>{priceStat}</StatGroup>
      )}

      <Section title={t("catalog.detail.detailsTitle")}>
        <DescriptionList
          items={[
            {
              label: t("catalog.detail.category"),
              value:
                categoryName === undefined ? (
                  <Skeleton className="h-3.5 w-28" />
                ) : categoryName === null ? (
                  <MutedValue>{t("catalog.detail.noCategory")}</MutedValue>
                ) : (
                  categoryName
                ),
            },
            {
              label: t("dataTable.columns.sku"),
              value: product.sku ?? <MutedValue>{t("catalog.detail.noSku")}</MutedValue>,
            },
            { label: t("catalog.detail.unit"), value: t(`catalog.unitLabels.${product.unitKind}`) },
            {
              label: t("catalog.detail.precision"),
              value:
                product.quantityPrecision === 0
                  ? t("catalog.detail.wholeNumbers")
                  : t("catalog.detail.precisionValue", { count: product.quantityPrecision }),
            },
            {
              label: t("catalog.detail.tracked"),
              value: product.tracked ? t("common.yes") : t("common.no"),
            },
            {
              label: t("catalog.detail.createdAt"),
              numeric: true,
              value: formatLocalizedDateTime(product.createdAt, locale, timeZone),
            },
            {
              label: t("catalog.detail.updatedAt"),
              numeric: true,
              value: formatLocalizedDateTime(product.updatedAt, locale, timeZone),
            },
          ]}
        />
      </Section>

      {movements ? (
        <Section
          actions={
            movements.read === "ready" && movements.items.length > 0 ? (
              <Link asChild href={stockHref(product.id)}>
                <Button accessibilityRole="link" className="gap-1 px-1" size="sm" variant="ghost">
                  <Text className="text-[13px]">{t("catalog.detail.viewHistory")}</Text>
                  <Icon as={ArrowRight} className="text-foreground" size={14} />
                </Button>
              </Link>
            ) : undefined
          }
          description={t("catalog.detail.movementsDescription")}
          title={t("catalog.detail.movementsTitle")}
        >
          <RecentMovements
            detail={detail}
            movements={movements}
            onRetry={onRetryMovements}
            recordAction={record}
          />
        </Section>
      ) : null}

      <ConfirmDialog
        confirmLabel={t("catalog.detail.archiveConfirm")}
        description={t("catalog.detail.archiveDescription")}
        destructive
        disabled={!canManage || isStale}
        errorMessage={archive.errorMessage}
        onCancel={archive.onCancel}
        onConfirm={archive.onConfirm}
        open={archive.open}
        phase={archive.phase}
        returnFocus={archive.returnFocus}
        title={t("catalog.detail.archiveTitle", { name: product.name })}
        uncertainDescription={t("catalog.detail.uncertainDescription")}
      />
    </Page>
  );
}

function RecentMovements({
  detail,
  movements,
  onRetry,
  recordAction,
}: {
  detail: ProductDetail;
  movements: { items: InventoryMovement[]; read: ReadState };
  onRetry: () => void;
  recordAction: HeaderAction | undefined;
}) {
  const { t } = useTranslation();
  if (movements.read === "loading") {
    return <ContentSkeleton label={t("inventory.history.loading")} variant="section" />;
  }
  if (movements.read === "offline") return <OfflineState level={3} />;
  if (movements.read !== "ready") {
    return (
      <StatePanel
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        description={t("inventory.history.unavailableDescription")}
        icon={TriangleAlert}
        level={3}
        title={t("inventory.history.unavailableTitle")}
        tone="destructive"
      />
    );
  }
  return (
    <View className="min-w-0">
      <MovementTable
        caption={t("catalog.detail.movementsTitle")}
        empty={
          <EmptyState
            action={
              recordAction?.href ? (
                <Link asChild href={recordAction.href}>
                  <Button accessibilityRole="link" size="sm" variant="outline">
                    <Text>{recordAction.label}</Text>
                  </Button>
                </Link>
              ) : undefined
            }
            description={t("inventory.history.emptyDescription")}
            icon={History}
            title={t("inventory.history.emptyTitle")}
          />
        }
        movements={movements.items.slice(0, RECENT_MOVEMENTS)}
        product={detail.product}
      />
    </View>
  );
}
