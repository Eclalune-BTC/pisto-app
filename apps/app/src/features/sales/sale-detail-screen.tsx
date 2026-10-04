import type { Sale } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { type Href, Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { Pencil, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData, readFailureKind } from "@/lib/query-state";
import { formatSaleInstant } from "./format";
import { saleQueryOptions } from "./queries";
import { SalesRouteState } from "./route-state";
import { SaleStatusBadge, saleAmount, saleOccurrenceItems } from "./sale-facts";
import { canCorrectSale, readState } from "./state";

function saleHref(saleId: string): Href {
  return { pathname: "/operate/sales/[saleId]", params: { saleId } };
}

function RecordLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link asChild href={href}>
      <Text
        accessibilityRole="link"
        className="self-start font-ui text-sm leading-5 text-foreground underline web:underline-offset-4"
      >
        {label}
      </Text>
    </Link>
  );
}

/** What corrected this sale and, when there is one, a link to the other side of the replacement. */
function correctionItems(sale: Sale, locale: string, t: TFunction): DescriptionItem[] {
  const correction = sale.correction;
  if (!correction) return [];
  const related =
    correction.replacementSaleId && correction.replacementSaleId !== sale.id
      ? {
          label: t("sales.correction.replacement"),
          value: (
            <RecordLink
              href={saleHref(correction.replacementSaleId)}
              label={t("sales.correction.openReplacement")}
            />
          ),
        }
      : correction.originalSaleId !== sale.id
        ? {
            label: t("sales.correction.original"),
            value: (
              <RecordLink
                href={saleHref(correction.originalSaleId)}
                label={t("sales.correction.openOriginal")}
              />
            ),
          }
        : null;
  return [
    {
      label: t("sales.correction.kind"),
      value:
        correction.kind === "replacement"
          ? t("sales.correction.kindReplacement")
          : t("sales.correction.kindVoid"),
    },
    { label: t("sales.correction.reason"), value: correction.reason },
    {
      label: t("sales.correction.correctedAt"),
      numeric: true,
      value: formatSaleInstant(correction.correctedAt, locale, sale.timeZone),
    },
    ...(related ? [related] : []),
  ];
}

export default function SaleDetailScreen() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const params = useLocalSearchParams<{ saleId?: string | string[] }>();
  const saleId = Array.isArray(params.saleId) ? params.saleId[0] : params.saleId;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  const canRead = permissions.includes("sales:read");
  const result = useQuery(saleQueryOptions(canRead ? business?.id : undefined, saleId));
  const sale = result.data?.sale;
  useRouteLabel("/operate/sales/[saleId]", sale ? saleAmount(sale, locale) : undefined);

  const access = readState([businesses]);
  if (access === "denied" || hasDeniedRead([result]) || (business && !canRead)) {
    return (
      <SalesRouteState
        description={t("sales.deniedDescription")}
        kind="denied"
        title={t("sales.deniedTitle")}
        width="form"
      />
    );
  }
  if (access === "error") {
    return (
      <SalesRouteState
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
      <SalesRouteState
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
      <SalesRouteState
        description={t("sales.detail.unavailableDescription")}
        kind="error"
        onRetry={() => void result.refetch()}
        title={t("sales.detail.unavailableTitle")}
        width="form"
      />
    );
  }
  if (read === "offline") return <SalesRouteState kind="offline" width="form" />;
  if (!sale) {
    return (
      <SalesRouteState
        kind="loading"
        label={t("sales.detail.loading")}
        variant="detail"
        width="form"
      />
    );
  }

  const stale = queryHasStaleData(businesses) || queryHasStaleData(result);
  const canCorrect = permissions.includes("sales:correct") && canCorrectSale(sale);
  const canCreate = permissions.includes("sales:create");
  return (
    <Page width="form">
      <PageHeader
        actions={
          canCorrect || canCreate ? (
            <>
              {canCorrect ? (
                <Button
                  disabled={stale}
                  onPress={() => {
                    if (!stale)
                      router.push({
                        pathname: "/operate/sales/correct/[saleId]",
                        params: { saleId: sale.id },
                      });
                  }}
                  variant="outline"
                >
                  <Icon as={Pencil} className="text-foreground" size={15} />
                  <Text>{t("sales.correction.open")}</Text>
                </Button>
              ) : null}
              {canCreate ? (
                <Button
                  disabled={stale}
                  onPress={() => {
                    if (!stale) router.push("/operate/sales/new");
                  }}
                  variant="default"
                >
                  <Icon as={Plus} className="text-primary-foreground" size={16} />
                  <Text>{t("sales.register")}</Text>
                </Button>
              ) : null}
            </>
          ) : undefined
        }
        adornment={<SaleStatusBadge status={sale.status} />}
        title={saleAmount(sale, locale)}
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
      <DescriptionList
        items={[
          ...saleOccurrenceItems(sale, locale, t),
          { label: t("common.currency"), value: sale.currency },
          { label: t("common.timeZone"), value: sale.timeZone },
          {
            label: t("sales.fields.recordedAt"),
            numeric: true,
            value: formatSaleInstant(sale.createdAt, locale, sale.timeZone),
          },
        ]}
      />
      {sale.correction ? (
        <Section
          description={
            sale.correction.replacementSaleId === sale.id
              ? t("sales.correction.replacementNote")
              : sale.correction.kind === "replacement"
                ? t("sales.correction.replacedNote")
                : t("sales.correction.voidedNote")
          }
          title={t("sales.correction.details")}
        >
          <DescriptionList items={correctionItems(sale, locale, t)} />
        </Section>
      ) : null}
    </Page>
  );
}
