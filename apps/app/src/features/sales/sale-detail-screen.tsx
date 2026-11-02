import type { Business, Sale, SaleDetails } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { type Href, Link, Redirect, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { Info, Pencil } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
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
import { formatLocalDate, formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData, readFailureKind } from "@/lib/query-state";
import { SaleLinesTable } from "./itemized/sale-lines-table";
import { saleFormOptionsQueryOptions, saleQueryOptions } from "./queries";
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

/** Who bought, what was paid into which account and what is still owed. */
function settlementItems(
  sale: Sale,
  details: SaleDetails,
  accountName: string | null,
  locale: string,
  t: TFunction,
): DescriptionItem[] {
  const { settlement } = details;
  const money = (value: string) =>
    formatMinorUnits(value, sale.currency, sale.currencyMinorUnitDigits, locale);
  const items: DescriptionItem[] = [
    {
      label: t("sales.detail.customer"),
      value: settlement.customerName ?? t("sales.itemized.counterSale"),
    },
    { label: t("sales.detail.paid"), numeric: true, value: money(settlement.receivedMinorUnits) },
  ];
  if (settlement.paymentMethod !== null) {
    items.push(
      {
        label: t("sales.detail.method"),
        value: t(`sales.itemized.methods.${settlement.paymentMethod}`),
      },
      { label: t("sales.detail.account"), value: accountName ?? t("sales.detail.accountUnknown") },
    );
  }
  if (settlement.creditMinorUnits !== "0") {
    items.push({
      label: t("sales.detail.owes"),
      numeric: true,
      value: settlement.receivableId ? (
        <View className="flex-row flex-wrap items-baseline gap-x-3">
          <Text className="font-ui text-sm tabular-nums">{money(settlement.creditMinorUnits)}</Text>
          <Link
            asChild
            href={{
              pathname: "/operate/receivables/[receivableId]",
              params: { receivableId: settlement.receivableId },
            }}
          >
            <Text className="text-sm leading-5 text-link underline web:underline-offset-4">
              {t("sales.detail.viewReceivable")}
            </Text>
          </Link>
        </View>
      ) : (
        money(settlement.creditMinorUnits)
      ),
    });
    if (settlement.dueDate) {
      items.push({
        label: t("sales.detail.dueDate"),
        numeric: true,
        value: formatLocalDate(settlement.dueDate, locale),
      });
    }
  }
  return items;
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
  const details = result.data?.details ?? null;
  // Sellers cannot read cash accounts; the sale form's account names cover every role that sells.
  const accountId = details?.settlement.accountId ?? null;
  const accountOptions = useQuery(
    saleFormOptionsQueryOptions(
      accountId && permissions.includes("sales:create") ? business?.id : undefined,
    ),
  );
  const accountName = accountId
    ? (accountOptions.data?.accounts.find(({ id }) => id === accountId)?.name ?? null)
    : null;
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
                label:
                  sale.entryMode === "itemized"
                    ? t("sales.correction.voidItemized")
                    : t("sales.correction.open"),
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
      {details ? (
        <Section title={t("sales.detail.productsTitle")}>
          <SaleLinesTable
            currency={sale.currency}
            currencyDigits={sale.currencyMinorUnitDigits}
            lines={details.lines}
          />
        </Section>
      ) : null}
      {details ? (
        <Section title={t("sales.detail.settlementTitle")}>
          <DescriptionList items={settlementItems(sale, details, accountName, locale, t)} />
        </Section>
      ) : null}
      <Section title={t("sales.detail.detailsTitle")}>
        <DescriptionList
          items={[
            { label: t("sales.fields.moment"), numeric: true, value: saleMoment(sale, locale) },
            { label: t("sales.detail.source"), value: t(`sales.sources.${sale.entrySource}`) },
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
