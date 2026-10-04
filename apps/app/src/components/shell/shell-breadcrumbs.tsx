import { useQuery } from "@tanstack/react-query";
import { type Href, useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { Fragment, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShellRouteLabels, useShellVisits } from "@/components/shell/shell-context";
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
import {
  buildRouteTrail,
  queryOutsideRoute,
  routeFromSegments,
  type ShellRoute,
} from "@/lib/route-trail";

export function ShellBreadcrumbs({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const pathname = usePathname();
  const recordLabels = useShellRouteLabels();
  const { lastVisit, rememberVisit } = useShellVisits();
  const businesses = useQuery(businessesQueryOptions);
  const route = routeFromSegments(segments);
  const query = route ? queryOutsideRoute(route, params) : "";

  useEffect(() => {
    if (route) rememberVisit(route, pathname, query);
  }, [pathname, query, rememberVisit, route]);

  if (!route) return null;

  const businessName = hasDeniedRead([businesses])
    ? undefined
    : getActiveBusiness(businesses.data)?.name;
  const label = (entry: ShellRoute) =>
    recordLabels[entry] ??
    (entry === "/operate" && businessName ? businessName : t(`shell.routes.${entry}`));
  const trail = buildRouteTrail(route, params).map((entry) =>
    entry.href ? { ...entry, href: lastVisit(entry.route, entry.href) ?? entry.href } : entry,
  );

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
