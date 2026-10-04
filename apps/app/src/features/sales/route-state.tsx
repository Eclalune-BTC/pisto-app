import { Ban, Lock, SearchX, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

type PageWidth = "content" | "form";

type SalesRouteStateProps =
  | { kind: "loading"; label: string; variant: "list" | "detail" | "form"; width: PageWidth }
  | { kind: "offline"; width: PageWidth }
  | {
      action?: ReactNode;
      description: string;
      kind: "denied" | "notFound" | "unavailable";
      title: string;
      width: PageWidth;
    }
  | { description: string; kind: "error"; onRetry: () => void; title: string; width: PageWidth };

/** A whole-route state before the record can render; its panel is the page's only heading. */
export function SalesRouteState(props: SalesRouteStateProps) {
  const { t } = useTranslation();
  return (
    <Page width={props.width}>
      {props.kind === "loading" ? (
        <ContentSkeleton label={props.label} variant={props.variant} />
      ) : props.kind === "offline" ? (
        <OfflineState />
      ) : props.kind === "error" ? (
        <StatePanel
          action={
            <Button label={t("common.retry")} onPress={props.onRetry} size="sm" variant="outline" />
          }
          description={props.description}
          icon={TriangleAlert}
          level={1}
          title={props.title}
          tone="destructive"
        />
      ) : (
        <StatePanel
          action={props.action}
          description={props.description}
          icon={props.kind === "denied" ? Lock : props.kind === "notFound" ? SearchX : Ban}
          level={1}
          title={props.title}
        />
      )}
    </Page>
  );
}
