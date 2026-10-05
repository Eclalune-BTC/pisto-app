import { Ban, Lock, SearchX, TriangleAlert } from "lucide-react-native";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export type RouteStateKind =
  | "denied"
  | "error"
  | "loading"
  | "notFound"
  | "offline"
  | "unavailable";

type PageWidth = NonNullable<ComponentProps<typeof Page>["width"]>;

type RouteStateProps = {
  /** The way forward from a state that ends the route, such as a link to its list. */
  action?: ReactNode;
  /** Replaces the generic description with one that names the record. */
  description?: string;
  kind: RouteStateKind;
  /** What is loading, for assistive technology. */
  label?: string;
  /** Offered with the error state only. */
  onRetry?: () => void;
  /** Replaces the generic title with one that names the record. */
  title?: string;
  /** The shape the route takes once loaded, so the page does not jump. */
  variant?: "detail" | "form" | "list";
  width?: PageWidth;
};

/**
 * A whole route that cannot show its records yet or at all. Its panel is the page's only heading,
 * and it never keeps cached private records on screen.
 */
export function RouteState({
  action,
  description,
  kind,
  label,
  onRetry,
  title,
  variant = "list",
  width = "content",
}: RouteStateProps) {
  const { t } = useTranslation();
  if (kind === "loading") {
    return (
      <Page width={width}>
        <ContentSkeleton label={label ?? t("routeState.loading")} variant={variant} />
      </Page>
    );
  }
  if (kind === "offline") {
    return (
      <Page width={width}>
        <OfflineState />
      </Page>
    );
  }
  if (kind === "error") {
    return (
      <Page width={width}>
        <StatePanel
          action={
            onRetry || action ? (
              <>
                {onRetry ? (
                  <Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />
                ) : null}
                {action}
              </>
            ) : undefined
          }
          description={description ?? t("routeState.errorDescription")}
          icon={TriangleAlert}
          level={1}
          title={title ?? t("routeState.errorTitle")}
          tone="destructive"
        />
      </Page>
    );
  }
  const copy = {
    denied: {
      description: t("routeState.deniedDescription"),
      icon: Lock,
      title: t("routeState.deniedTitle"),
    },
    notFound: {
      description: t("routeState.notFoundDescription"),
      icon: SearchX,
      title: t("routeState.notFoundTitle"),
    },
    unavailable: {
      description: t("routeState.unavailableDescription"),
      icon: Ban,
      title: t("routeState.unavailableTitle"),
    },
  }[kind];
  return (
    <Page width={width}>
      <StatePanel
        action={action}
        description={description ?? copy.description}
        icon={copy.icon}
        level={1}
        title={title ?? copy.title}
      />
    </Page>
  );
}
