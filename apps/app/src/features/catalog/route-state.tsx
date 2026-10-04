import { Ban, Lock, SearchX, TriangleAlert } from "lucide-react-native";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export type CapabilityRouteStateKind =
  | "denied"
  | "error"
  | "loading"
  | "notFound"
  | "offline"
  | "unavailable";

type PageWidth = NonNullable<ComponentProps<typeof Page>["width"]>;

type CapabilityRouteStateProps = {
  /** The way forward from a state that ends the route, such as a link to its list. */
  action?: ReactNode;
  /** Replaces the generic description with one that names the record. */
  description?: string;
  /** What is loading, for assistive technology. */
  label?: string;
  /** Replaces the generic title with one that names the record. */
  title?: string;
  /** The shape the route takes once loaded, so the page does not jump. */
  variant?: "detail" | "form" | "list";
  width?: PageWidth;
} & (
  | { kind: "error"; onRetry: () => void }
  | { kind: Exclude<CapabilityRouteStateKind, "error">; onRetry?: never }
);

/**
 * A whole route that cannot show its records yet or at all. Its panel is the page's only heading,
 * and it never keeps cached private records on screen.
 */
export function CapabilityRouteState(props: CapabilityRouteStateProps) {
  const { t } = useTranslation();
  const { action, variant = "list", width = "content" } = props;
  if (props.kind === "loading") {
    return (
      <Page width={width}>
        <ContentSkeleton label={props.label ?? t("catalog.remote.loading")} variant={variant} />
      </Page>
    );
  }
  if (props.kind === "offline") {
    return (
      <Page width={width}>
        <OfflineState />
      </Page>
    );
  }
  if (props.kind === "error") {
    return (
      <Page width={width}>
        <StatePanel
          action={
            <>
              <Button
                label={t("common.retry")}
                onPress={props.onRetry}
                size="sm"
                variant="outline"
              />
              {action}
            </>
          }
          description={props.description ?? t("catalog.remote.errorDescription")}
          icon={TriangleAlert}
          level={1}
          title={props.title ?? t("catalog.remote.errorTitle")}
          tone="destructive"
        />
      </Page>
    );
  }
  const copy = {
    denied: {
      description: t("catalog.remote.deniedDescription"),
      icon: Lock,
      title: t("catalog.remote.deniedTitle"),
    },
    notFound: {
      description: t("catalog.remote.notFoundDescription"),
      icon: SearchX,
      title: t("catalog.remote.notFoundTitle"),
    },
    unavailable: {
      description: t("catalog.remote.unavailableDescription"),
      icon: Ban,
      title: t("catalog.remote.unavailableTitle"),
    },
  }[props.kind];
  return (
    <Page width={width}>
      <StatePanel
        action={action}
        description={props.description ?? copy.description}
        icon={copy.icon}
        level={1}
        title={props.title ?? copy.title}
      />
    </Page>
  );
}
