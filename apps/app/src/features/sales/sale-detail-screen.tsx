import type { Business, Sale } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { type Href, Link, Redirect, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { Info, Pencil } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { HeaderActions } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData, readFailureKind } from "@/lib/query-state";
import { saleQueryOptions } from "./queries";
import { SaleStatusBadge, saleAmount, saleMoment } from "./sale-facts";
import { canCorrectSale, readState } from "./state";

function saleHref(saleId: string): Href {
  return { pathname: "/operate/sales/[saleId]", params: { saleId } };
}

/** What happened to a corrected sale and, when there is one, the way to the other side. */
function CorrectionNotice({ sale, t }: { sale: Sale; t: TFunction }) {
  const correction = sale.correction;
  if (!correction) return null;
  const related =
    correction.replacementSaleId === sale.id
      ? { href: saleHref(correction.originalSaleId), label: t("sales.correction.viewOriginal") }
      : correction.replacementSaleId
        ? {
            href: saleHref(correction.replacementSaleId),
            label: t("sales.correction.viewReplacement"),
          }
        : null;
  return (
    <Alert
      action={
        related ? (
          <Link asChild href={related.href}>
            <Button accessibilityRole="link" size="sm" variant="outline">
              <Text>{related.label}</Text>
            </Button>
          </Link>
        ) : undefined
      }
      icon={Info}
      role="note"
    >
      <AlertDescription>
        {correction.replacementSaleId === sale.id
          ? t("sales.correction.replacementNote")
          : correction.kind === "replacement"
            ? t("sales.correction.replacedNote")
            : t("sales.correction.voidedNote")}
      </AlertDescription>
    </Alert>
  );
}

/** Currency and time zone are only worth a row when the sale was recorded under other settings. */
function settingItems(sale: Sale, business: Business, t: TFunction): DescriptionItem[] {
  return [
    ...(sale.currency === business.currency
      ? []
      : [{ label: t("common.currency"), value: sale.currency }]),
    ...(sale.timeZone === business.timeZone
      ? []
      : [{ label: t("common.timeZone"), value: sale.timeZone }]),
  ];
}

export default function SaleDetailScreen() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  const canRead = permissions.includes("sales:read");
  const result = useQuery(saleQueryOptions(canRead ? business?.id : undefined, saleId));
  const sale = result.data?.sale;
  const title = sale
    ? (sale.description ?? t("sales.detail.title", { moment: saleMoment(sale, locale) }))
    : undefined;
  useRouteLabel("/operate/sales/[saleId]", title);

  const access = readState([businesses]);
  if (access === "denied" || hasDeniedRead([result]) || (business && !canRead)) {
    return (
      <RouteState
        description={t("sales.deniedDescription")}
        kind="denied"
        title={t("sales.deniedTitle")}
        width="form"
      />
    );
  }
  if (access === "error") {
    return (
      <RouteState
        description={t("sales.unavailableDescription")}
        kind="error"
        onRetry={() => void businesses.refetch()}
        title={t("sales.unavailableTitle")}
        width="form"
      />
    );
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  const missing = access === "ready" && !saleId;
  const read = access === "ready" ? readState([result]) : access;
  if (missing || (read === "error" && readFailureKind(result.error) === "notFound")) {
    return (
      <RouteState
        action={
          <Link asChild href="/operate/sales">
            <Button accessibilityRole="link" size="sm" variant="outline">
              <Text>{t("sales.goToSales")}</Text>
            </Button>
          </Link>
        }
        description={t("sales.detail.notFoundDescription")}
        kind="notFound"
        title={t("sales.detail.notFoundTitle")}
        width="form"
      />
    );
  }
  if (read === "error") {
    return (
      <RouteState
        description={t("sales.detail.unavailableDescription")}
        kind="error"
        onRetry={() => void result.refetch()}
        title={t("sales.detail.unavailableTitle")}
        width="form"
      />
    );
  }
  if (read === "offline") return <RouteState kind="offline" width="form" />;
  if (!sale || !business) {
    return (
      <RouteState kind="loading" label={t("sales.detail.loading")} variant="detail" width="form" />
    );
  }

  const stale = queryHasStaleData(businesses) || queryHasStaleData(result);
  const canCorrect = permissions.includes("sales:correct") && canCorrectSale(sale);
  return (
    <Page>
      <PageHeader
        actions={
          canCorrect ? (
            <HeaderActions
              menuLabel={t("sales.detail.moreActions")}
              primary={{
                disabled: stale,
                href: { pathname: "/operate/sales/correct/[saleId]", params: { saleId: sale.id } },
                icon: Pencil,
                label: t("sales.correction.open"),
              }}
            />
          ) : undefined
        }
        adornment={<SaleStatusBadge status={sale.status} />}
        title={title ?? ""}
      />
      {stale ? (
        <StaleNotice
          loading={businesses.isFetching || result.isFetching}
          onRetry={() => {
            void businesses.refetch();
            void result.refetch();
          }}
        />
      ) : null}
      <CorrectionNotice sale={sale} t={t} />
      <StatGroup>
        <Stat
          detail={sale.status === "voided" ? t("sales.detail.voidedTotal") : undefined}
          label={t("sales.fields.total")}
          value={saleAmount(sale, locale)}
        />
      </StatGroup>
      <Section title={t("sales.detail.detailsTitle")}>
        <DescriptionList
          items={[
            { label: t("sales.fields.moment"), numeric: true, value: saleMoment(sale, locale) },
            {
              label: t("sales.fields.recordedAt"),
              numeric: true,
              value: formatLocalizedDateTime(sale.createdAt, locale, sale.timeZone),
            },
            ...settingItems(sale, business, t),
          ]}
        />
      </Section>
      {sale.correction ? (
        <Section title={t("sales.correction.details")}>
          <DescriptionList
            items={[
              { label: t("sales.correction.reason"), value: sale.correction.reason },
              {
                label: t("sales.correction.correctedAt"),
                numeric: true,
                value: formatLocalizedDateTime(sale.correction.correctedAt, locale, sale.timeZone),
              },
            ]}
          />
        </Section>
      ) : null}
    </Page>
  );
}
