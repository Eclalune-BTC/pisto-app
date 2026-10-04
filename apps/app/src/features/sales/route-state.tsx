import { Ban, Lock, SearchX, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";

type PageWidth = "content" | "form";

const RECORD_ROWS = 5;

/** A sale detail's shape: the amount with its badge, then the label/value facts. */
function RecordSkeleton({ label }: { label: string }) {
  return (
    <View accessibilityLabel={label} aria-busy className="gap-6">
      <Text className="sr-only">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-5 w-16" />
      </View>
      <View className="overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: RECORD_ROWS }, (_, index) => (
          <View
            className="flex-row items-center gap-6 border-b border-border px-4 py-3 last:border-b-0"
            // biome-ignore lint/suspicious/noArrayIndexKey: Placeholder rows have no identity.
            key={index}
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-40" />
          </View>
        ))}
      </View>
    </View>
  );
}

type SalesRouteStateProps =
  | { kind: "loading"; label: string; variant: "list" | "record" | "form"; width: PageWidth }
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
        props.variant === "record" ? (
          <RecordSkeleton label={props.label} />
        ) : (
          <ContentSkeleton label={props.label} variant={props.variant} />
        )
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
