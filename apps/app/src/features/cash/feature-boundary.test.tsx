import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: () => "#18181B",
}));
vi.mock("@/components/page", () => ({ Page: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));

import { FeatureBoundary, type FeatureRemoteState } from "./feature-boundary";

const copy = {
  loading: "Loading",
  deniedTitle: "Access denied",
  deniedDescription: "No access",
  offlineTitle: "Offline",
  unavailableTitle: "Unavailable",
  retry: "Retry",
};

describe("remote-state heading hierarchy", () => {
  const states: FeatureRemoteState[] = [
    { kind: "denied" },
    { kind: "offline", message: "Offline" },
    { kind: "error", message: "Failed" },
  ];
  for (const state of states) {
    for (const inline of [false, true]) {
      test(`${state.kind} uses level ${inline ? 2 : 1} when inline=${inline}`, () => {
        const html = renderToStaticMarkup(
          <FeatureBoundary state={state} copy={copy} inline={inline} onRetry={vi.fn()}>
            Private content
          </FeatureBoundary>,
        );
        expect(html).toContain(`aria-level="${inline ? 2 : 1}"`);
        expect(html).not.toContain("Private content");
      });
    }
  }
});
