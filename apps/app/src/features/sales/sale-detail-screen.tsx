import type { Business, Sale } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";
import { type Href, Link, Redirect, useLocalSearchParams } from "expo-router";
import type { TFunction } from "i18next";
import { Info, type LucideIcon, Pencil, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

/**
 * A header command: a real link while the page is current, a disabled button while it is stale,
 * because a financial command must not start from figures that could not be refreshed.
 */
function headerCommand(command: { href: Href; icon: LucideIcon; label: string; stale: boolean }) {
  const content: ReactNode = (
    <>
      <Icon as={command.icon} size={15} />
      <Text>{command.label}</Text>
    </>
  );
  return command.stale ? (
    <Button disabled key={command.label} variant="outline">
      {content}
    </Button>
  ) : (
    <Link asChild href={command.href} key={command.label}>
      <Button accessibilityRole="link" variant="outline">
        {content}
      </Button>
    </Link>
  );
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
  if (!sale || !business) {
    return (
      <SalesRouteState
        kind="loading"
        label={t("sales.detail.loading")}
        variant="record"
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
              {canCorrect
                ? headerCommand({
                    href: {
                      pathname: "/operate/sales/correct/[saleId]",
                      params: { saleId: sale.id },
                    },
                    icon: Pencil,
                    label: t("sales.correction.open"),
                    stale,
                  })
                : null}
              {canCreate
                ? headerCommand({
                    href: "/operate/sales/new",
                    icon: Plus,
                    label: t("sales.register"),
                    stale,
                  })
                : null}
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
      <CorrectionNotice sale={sale} t={t} />
      <DescriptionList
        items={[
          ...saleOccurrenceItems(sale, locale, t),
          {
            label: t("sales.fields.recordedAt"),
            numeric: true,
            value: formatSaleInstant(sale.createdAt, locale, sale.timeZone),
          },
          ...settingItems(sale, business, t),
        ]}
      />
      {sale.correction ? (
        <Section title={t("sales.correction.details")}>
          <DescriptionList
            items={[
              { label: t("sales.correction.reason"), value: sale.correction.reason },
              {
                label: t("sales.correction.correctedAt"),
                numeric: true,
                value: formatSaleInstant(sale.correction.correctedAt, locale, sale.timeZone),
              },
            ]}
          />
        </Section>
      ) : null}
    </Page>
  );
}
