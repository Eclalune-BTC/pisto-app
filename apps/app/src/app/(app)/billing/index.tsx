import type { BillingCatalogProduct, Entitlement } from "@pisto/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  ExternalLink,
  type LucideIcon,
  Smartphone,
  TriangleAlert,
} from "lucide-react-native";
import { type PropsWithChildren, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { formatLocalizedDate } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { deriveBillingAccessState } from "@/lib/billing/billing-access";
import { deriveBillingOffer } from "@/lib/billing/billing-offer";
import { platformBilling } from "@/lib/billing/platform-billing";
import { notify } from "@/lib/notify";

type EntitlementRow = Entitlement & { rowId: string };

/** The account area's two-column section, matching Cuenta: label left, content right. */
function AccountSection({
  children,
  description,
  title,
}: PropsWithChildren<{ description: string; title: string }>) {
  return (
    <View accessibilityLabel={title} className="min-w-0 gap-3 lg:flex-row lg:gap-10" role="region">
      <View className="min-w-0 gap-0.5 lg:w-64 lg:shrink-0">
        <Heading level={2} size="section">
          {title}
        </Heading>
        <Text className="text-[13px] leading-5 text-muted-foreground">{description}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-3 lg:max-w-2xl">{children}</View>
    </View>
  );
}

function BlockSkeleton({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} aria-busy className="gap-2">
      <Text className="sr-only">{label}</Text>
      <Skeleton className="h-11 w-full" />
    </View>
  );
}

function EntitlementTable({ items, locale }: { items: Entitlement[]; locale: string }) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<EntitlementRow>[]>(
    () => [
      {
        id: "key",
        header: t("billing.access.key"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-[13px]">{original.key}</Text>
        ),
      },
      {
        id: "source",
        header: t("billing.access.source"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground">
            {t(`billing.access.sources.${original.source}`)}
          </Text>
        ),
      },
      {
        id: "validity",
        header: t("billing.access.validity"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] tabular-nums">
            {original.validUntil
              ? t("billing.access.validUntil", {
                  date: formatLocalizedDate(original.validUntil, locale),
                })
              : t("billing.access.noExpiry")}
          </Text>
        ),
      },
      {
        id: "status",
        header: t("common.status"),
        meta: { figure: true },
        cell: () => <StatusBadge label={t("billing.access.active")} tone="settled" />,
      },
    ],
    [locale, t],
  );
  return (
    <DataTable
      caption={t("billing.access.title")}
      columns={columns}
      // The API lists only grants that are active now and has no row identity to show.
      data={items.map((item, index) => ({ ...item, rowId: String(index) }))}
      getRowId={(row) => row.rowId}
    />
  );
}

function ProductCards({
  onPurchase,
  pendingSlug,
  products,
}: {
  onPurchase: (slug: string) => void;
  pendingSlug: string | undefined;
  products: BillingCatalogProduct[];
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-3">
        {products.map((product) => (
          <Card
            className="min-w-[240px] flex-1 basis-[260px] justify-between gap-4 px-4 py-4 shadow-none"
            key={product.slug}
          >
            <View className="gap-1">
              <Text className="font-heading text-sm">{product.name ?? product.slug}</Text>
              {product.description ? (
                <Text className="text-[13px] leading-5 text-muted-foreground">
                  {product.description}
                </Text>
              ) : null}
            </View>
            <Button
              className="self-start"
              disabled={pendingSlug !== undefined && pendingSlug !== product.slug}
              loading={pendingSlug === product.slug}
              onPress={() => onPurchase(product.slug)}
            >
              <Text>{t("billing.plans.checkout")}</Text>
              <Icon as={ExternalLink} className="text-primary-foreground" size={14} />
            </Button>
          </Card>
        ))}
      </View>
      <Text className="text-xs leading-4 text-muted-foreground">
        {t("billing.plans.checkoutNote")}
      </Text>
    </View>
  );
}

function OfferPanel({
  icon,
  onRetry,
  retrying,
  text,
  title,
  tone = "default",
}: {
  icon: LucideIcon;
  onRetry?: () => void;
  retrying?: boolean;
  text: string;
  title: string;
  tone?: "default" | "destructive";
}) {
  const { t } = useTranslation();
  return (
    <StatePanel
      action={
        onRetry ? (
          <Button
            label={t("common.retry")}
            loading={retrying}
            onPress={onRetry}
            size="sm"
            variant="outline"
          />
        ) : undefined
      }
      description={text}
      icon={icon}
      level={3}
      title={title}
      tone={tone}
    />
  );
}

export default function BillingScreen() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const { capabilities } = platformBilling;
  // Only the web channel can act on the catalog; a native build never reads it to sell.
  const catalog = useQuery({
    enabled: capabilities.canPurchase,
    queryFn: api.billing.catalog,
    queryKey: ["billing", "catalog"],
  });
  const entitlements = useQuery({
    queryFn: api.billing.entitlements,
    queryKey: ["billing", "entitlements"],
  });
  const offer = deriveBillingOffer(capabilities, catalog);
  const active = entitlements.data?.items.filter((item) => item.status === "active") ?? [];
  const access = deriveBillingAccessState({
    activeCount: active.length,
    fetchStatus: entitlements.fetchStatus,
    isError: entitlements.isError,
    isPending: entitlements.isPending,
  });

  const purchase = useMutation({
    mutationFn: platformBilling.purchase,
    onError: () => notify.error(t("billing.plans.purchaseError")),
    onSuccess: (result) => {
      if (result.status === "unavailable") notify.warning(t("billing.plans.purchaseUnavailable"));
    },
  });
  const manage = useMutation({
    mutationFn: platformBilling.manage,
    onError: () => notify.error(t("billing.manageError")),
    onSuccess: (result) => {
      if (result.status === "unavailable") notify.warning(t("billing.manageUnavailable"));
    },
  });
  // The provider portal exists only where checkout is enabled.
  const canManage =
    capabilities.canManage && (offer.kind === "available" || offer.kind === "empty");

  let accessContent: ReactNode;
  if (access === "unknown") {
    accessContent = (
      <OfferPanel
        icon={TriangleAlert}
        onRetry={() => void entitlements.refetch()}
        retrying={entitlements.isFetching}
        text={t("billing.access.unavailable")}
        title={t("billing.access.unavailableTitle")}
        tone="destructive"
      />
    );
  } else if (access === "checking" || !entitlements.data) {
    accessContent = <BlockSkeleton label={t("billing.access.checking")} />;
  } else {
    accessContent = (
      <>
        <DescriptionList
          items={[
            {
              label: t("common.status"),
              value:
                access === "active" ? (
                  <StatusBadge label={t("billing.access.active")} tone="settled" />
                ) : (
                  <StatusBadge label={t("billing.access.none")} tone="normal" />
                ),
            },
            {
              label: t("billing.access.scope"),
              value: t(`billing.access.scopes.${entitlements.data.scope.type}`),
            },
          ]}
        />
        {access === "active" ? <EntitlementTable items={active} locale={locale} /> : null}
      </>
    );
  }

  let offerContent: ReactNode;
  switch (offer.kind) {
    case "checking":
      offerContent = <BlockSkeleton label={t("billing.plans.loading")} />;
      break;
    case "unknown":
      offerContent = (
        <OfferPanel
          icon={TriangleAlert}
          onRetry={() => void catalog.refetch()}
          retrying={catalog.isFetching}
          text={t("billing.plans.unavailable")}
          title={t("billing.plans.unavailableTitle")}
          tone="destructive"
        />
      );
      break;
    case "disabled":
      offerContent = (
        <OfferPanel
          icon={CreditCard}
          text={t("billing.plans.disabled")}
          title={t("billing.plans.disabledTitle")}
        />
      );
      break;
    case "empty":
      offerContent = (
        <OfferPanel
          icon={CreditCard}
          text={t("billing.plans.empty")}
          title={t("billing.plans.emptyTitle")}
        />
      );
      break;
    case "not-offered-here":
      offerContent = (
        <OfferPanel
          icon={Smartphone}
          text={t("billing.plans.notOffered")}
          title={t("billing.plans.notOfferedTitle")}
        />
      );
      break;
    case "unresolved":
      offerContent = (
        <OfferPanel
          icon={TriangleAlert}
          text={t("billing.plans.unresolved")}
          title={t("billing.plans.unresolvedTitle")}
        />
      );
      break;
    case "available":
      offerContent = (
        <ProductCards
          onPurchase={(slug) => purchase.mutate(slug)}
          pendingSlug={purchase.isPending ? purchase.variables : undefined}
          products={offer.products}
        />
      );
      break;
  }

  return (
    <Page>
      <PageHeader
        actions={
          canManage ? (
            <Button loading={manage.isPending} onPress={() => manage.mutate()} variant="outline">
              <Text>{t("billing.manage")}</Text>
              <Icon as={ExternalLink} className="text-foreground" size={14} />
            </Button>
          ) : undefined
        }
        description={t("billing.description")}
        title={t("billing.title")}
      />
      <View className="min-w-0 gap-8">
        <AccountSection
          description={t("billing.access.description")}
          title={t("billing.access.title")}
        >
          {accessContent}
        </AccountSection>
        <AccountSection
          description={t("billing.plans.description")}
          title={t("billing.plans.title")}
        >
          {offerContent}
        </AccountSection>
      </View>
    </Page>
  );
}
