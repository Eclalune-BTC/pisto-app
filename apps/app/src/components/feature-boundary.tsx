import { Lock, TriangleAlert, WifiOff } from "lucide-react-native";
import type { ReactNode } from "react";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export type FeatureRemoteState =
  | { kind: "loading" }
  | { kind: "offline"; message: string }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

export type FeatureBoundaryCopy = {
  loading: string;
  deniedTitle: string;
  deniedDescription: string;
  offlineTitle: string;
  unavailableTitle: string;
  retry: string;
};

export function requireFeatureManageAccess(
  state: FeatureRemoteState,
  canManage: boolean,
): FeatureRemoteState {
  return state.kind === "ready" && !canManage ? { kind: "denied" } : state;
}

type FeatureBoundaryProps = {
  state: FeatureRemoteState;
  copy: FeatureBoundaryCopy;
  children: ReactNode;
  onRetry: () => void;
  inline?: boolean;
};

export function FeatureBoundary({
  state,
  copy,
  children,
  onRetry,
  inline = false,
}: FeatureBoundaryProps) {
  const level = inline ? 2 : 1;
  const wrap = (content: ReactNode) => (inline ? content : <Page>{content}</Page>);
  if (state.kind === "loading") {
    return wrap(<ContentSkeleton label={copy.loading} variant={inline ? "section" : "list"} />);
  }
  if (state.kind === "denied") {
    return wrap(
      <StatePanel
        description={copy.deniedDescription}
        icon={Lock}
        level={level}
        title={copy.deniedTitle}
      />,
    );
  }
  if (state.kind === "offline" || state.kind === "error") {
    return wrap(
      <StatePanel
        action={<Button label={copy.retry} onPress={onRetry} size="sm" variant="outline" />}
        description={state.message}
        icon={state.kind === "offline" ? WifiOff : TriangleAlert}
        level={level}
        title={state.kind === "offline" ? copy.offlineTitle : copy.unavailableTitle}
        tone={state.kind === "error" ? "destructive" : "default"}
      />,
    );
  }
  return children;
}
