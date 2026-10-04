import { Ban, Lock, SearchX, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export type ScreenStateKind =
  | "denied"
  | "error"
  | "loading"
  | "notFound"
  | "offline"
  | "unavailable";

/**
 * A whole route that cannot show its record yet or at all. Loading keeps the shape of the final
 * layout; failures keep the heading level of the page they replace.
 */
export function ScreenState({
  kind,
  onRetry,
  skeleton = "list",
  width = "content",
}: {
  kind: ScreenStateKind;
  onRetry?: () => void;
  skeleton?: "detail" | "form" | "list";
  width?: "content" | "form";
}) {
  const { t } = useTranslation();
  return (
    <Page width={width}>
      {kind === "loading" ? (
        <ContentSkeleton variant={skeleton} />
      ) : kind === "offline" ? (
        <OfflineState />
      ) : kind === "denied" ? (
        <StatePanel
          description={t("relationships.access.deniedDescription")}
          icon={Lock}
          level={1}
          title={t("relationships.access.deniedTitle")}
        />
      ) : kind === "notFound" ? (
        <StatePanel
          description={t("relationships.common.notFoundDescription")}
          icon={SearchX}
          level={1}
          title={t("relationships.common.notFoundTitle")}
        />
      ) : kind === "unavailable" ? (
        <StatePanel
          description={t("relationships.common.actionUnavailableDescription")}
          icon={Ban}
          level={1}
          title={t("relationships.common.actionUnavailableTitle")}
        />
      ) : (
        <StatePanel
          action={
            onRetry ? (
              <Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />
            ) : undefined
          }
          description={t("relationships.common.unavailableDescription")}
          icon={TriangleAlert}
          level={1}
          title={t("relationships.common.unavailableTitle")}
          tone="destructive"
        />
      )}
    </Page>
  );
}
