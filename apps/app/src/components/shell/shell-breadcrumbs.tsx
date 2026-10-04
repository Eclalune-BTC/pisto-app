import { useQuery } from "@tanstack/react-query";
import { type Href, useGlobalSearchParams, useSegments } from "expo-router";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { useShellRouteLabels } from "@/components/shell/shell-context";
import {
  Breadcrumb,
  BreadcrumbBack,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbText,
} from "@/components/ui/breadcrumb";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import { buildRouteTrail, routeFromSegments, type ShellRoute } from "@/lib/route-trail";

export function ShellBreadcrumbs({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const recordLabels = useShellRouteLabels();
  const businesses = useQuery(businessesQueryOptions);
  const route = routeFromSegments(segments);
  if (!route) return null;

  const businessName = hasDeniedRead([businesses])
    ? undefined
    : getActiveBusiness(businesses.data)?.name;
  const label = (entry: ShellRoute) =>
    recordLabels[entry] ??
    (entry === "/operate" && businessName ? businessName : t(`shell.routes.${entry}`));
  const trail = buildRouteTrail(route, params);

  if (compact) {
    const parent = trail.at(-2);
    return (
      <Breadcrumb label={t("shell.breadcrumb")}>
        {parent?.href ? (
          <BreadcrumbBack href={parent.href as Href}>{label(parent.route)}</BreadcrumbBack>
        ) : (
          <BreadcrumbPage>{label(route)}</BreadcrumbPage>
        )}
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb label={t("shell.breadcrumb")}>
      <BreadcrumbList>
        {trail.map((entry, index) => (
          <Fragment key={entry.route}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem>
              {entry.route === route ? (
                <BreadcrumbPage>{label(entry.route)}</BreadcrumbPage>
              ) : entry.href ? (
                <BreadcrumbLink href={entry.href as Href}>{label(entry.route)}</BreadcrumbLink>
              ) : (
                <BreadcrumbText>{label(entry.route)}</BreadcrumbText>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
