import { QueryClient } from "@tanstack/react-query";
import {
  type ComponentProps,
  cloneElement,
  createElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  pathname: "/settings",
  width: 1440,
  query: {} as Record<string, unknown>,
  pending: false,
  error: undefined as string | undefined,
  signOut: vi.fn(),
  dialog: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => fixture.query,
}));
vi.mock("react-native", async () => ({
  ...(await vi.importActual<typeof import("react-native")>("react-native-web")),
  useWindowDimensions: () => ({ width: fixture.width, height: 800, scale: 1, fontScale: 1 }),
}));
vi.mock("react-native-safe-area-context", async () => ({
  SafeAreaView: (await vi.importActual<typeof import("react-native")>("react-native-web")).View,
}));
vi.mock("expo-router", () => ({
  usePathname: () => fixture.pathname,
  Link: ({ children, href }: { children: ReactElement<Record<string, unknown>>; href: string }) =>
    cloneElement(children, { href, accessibilityRole: "link" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: () => ["#18181B", "#71717A"],
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("@/components/appearance-control", () => ({
  AppearanceControl: () => createElement("span", {}, "appearance-control"),
}));
vi.mock("@/components/brand", () => ({ Brand: () => createElement("span", {}, "Pisto") }));
vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    isPending: fixture.pending,
    error: fixture.error,
    signOut: fixture.signOut,
  }),
}));
vi.mock("@/lib/api-client", () => ({ api: { businesses: { list: vi.fn() } } }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  CreditCard: () => null,
  LogOut: () => null,
  Menu: () => null,
  ReceiptText: () => null,
  UserRound: () => null,
  X: () => null,
}));

// These tests exercise shell composition and query truth. Dialog focus, Escape and
// responsive layout require the primary's real-library browser validation.
vi.mock("@/components/ui/dialog", () => {
  const childrenOnly = ({ children }: { children: ReactNode }) => children;
  return {
    Dialog: (props: Record<string, unknown> & { children: ReactNode }) => {
      fixture.dialog = props;
      return props.children;
    },
    DialogTrigger: childrenOnly,
    DialogClose: childrenOnly,
    DialogContent: ({ children }: { children: ReactNode }) =>
      createElement("section", { "data-testid": "navigation-dialog" }, children),
    DialogHeader: childrenOnly,
    DialogTitle: childrenOnly,
    DialogDescription: childrenOnly,
  };
});
vi.mock("@/components/ui/separator", () => ({ Separator: () => createElement("hr") }));

import { AppShell } from "@/components/app-shell";
import { SidebarLink } from "@/components/ui/sidebar";
import { OPERATE_MODULES } from "@/features/operate/navigation";
import { ApiClientError } from "@/lib/api-error";

function renderShell() {
  return renderToStaticMarkup(
    createElement(AppShell, { email: "owner@example.test", name: "Owner" }, "Route content"),
  );
}

function links(markup: string) {
  return [...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(([tag, href]) => ({
    tag,
    href,
  }));
}

beforeEach(() => {
  fixture.pathname = "/settings";
  fixture.width = 1440;
  fixture.pending = false;
  fixture.error = undefined;
  fixture.signOut.mockClear();
  fixture.dialog = {};
  fixture.query = {
    data: {
      activeBusinessId: "business-a",
      items: [
        {
          id: "business-a",
          name: "Authorized business",
          access: { permissions: OPERATE_MODULES.map(({ permission }) => permission) },
        },
      ],
    },
    error: null,
    isError: false,
    fetchStatus: "idle",
  };
});

describe("shell navigation", () => {
  test.each(["/operate", "/settings", "/billing", "/billing/success"])(
    "keeps every authorized module reachable from %s",
    (pathname) => {
      fixture.pathname = pathname;
      const markup = renderShell();
      const destinations = links(markup).map(({ href }) => href);
      expect(destinations).toEqual([
        "/operate",
        ...OPERATE_MODULES.map(({ href }) => href),
        "/settings",
        "/billing",
      ]);
      expect(markup).toContain("Authorized business");
      expect(markup).toContain('role="navigation"');
      expect(markup).toContain('role="main"');
    },
  );

  test("uses the same links in the compact dialog and keeps only two bottom destinations", () => {
    const desktopLinks = links(renderShell()).map(({ href }) => href);
    fixture.width = 320;
    const compact = renderShell();
    expect(links(compact).map(({ href }) => href)).toEqual([
      ...desktopLinks,
      "/operate",
      "/settings",
    ]);
    expect(compact).toContain('aria-label="shell.openNavigation"');
    expect(compact).toContain('aria-label="shell.closeNavigation"');
    expect(compact).toContain("shell.navigationDescription");
    expect(fixture.dialog.open).toBe(false);
    expect(fixture.dialog.onOpenChange).toBeTypeOf("function");
  });

  test("exposes only the current business membership's allowed modules", () => {
    fixture.query.data = {
      activeBusinessId: "business-b",
      items: [
        {
          id: "business-a",
          name: "Other business",
          access: { permissions: OPERATE_MODULES.map(({ permission }) => permission) },
        },
        {
          id: "business-b",
          name: "Current business",
          access: { permissions: ["sales:read", "catalog:read", "inventory:read"] },
        },
      ],
    };
    const markup = renderShell();
    expect(links(markup).map(({ href }) => href)).toEqual([
      "/operate",
      "/operate/sales",
      "/operate/catalog",
      "/operate/inventory",
      "/settings",
      "/billing",
    ]);
    expect(markup).not.toContain("Other business");
  });

  test.each([undefined, { activeBusinessId: null, items: [] }])(
    "does not invent module links without a resolved business (%j)",
    (data) => {
      fixture.query.data = data;
      expect(links(renderShell()).map(({ href }) => href)).toEqual([
        "/operate",
        "/settings",
        "/billing",
      ]);
    },
  );

  test.each([401, 403])(
    "hides cached business identity and module links after HTTP %s",
    async (status) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const queryKey = ["businesses"];
      const cached = fixture.query.data;
      client.setQueryData(queryKey, cached);
      const error = new ApiClientError("Access denied", status);
      await expect(
        client.fetchQuery({ queryKey, queryFn: async () => Promise.reject(error) }),
      ).rejects.toBe(error);
      const query = client.getQueryState(queryKey);
      expect(query?.data).toBe(cached);
      fixture.query = { ...query, isError: true };
      for (const width of [320, 1440]) {
        fixture.width = width;
        const markup = renderShell();
        expect(markup).not.toContain("Authorized business");
        for (const module of OPERATE_MODULES) {
          expect(links(markup).map(({ href }) => href)).not.toContain(module.href);
        }
        expect(markup).toContain('href="/settings"');
        expect(markup).toContain('href="/billing"');
        expect(markup).toContain("common.signOut");
      }
      client.clear();
    },
  );

  test("retains and labels cached navigation during a transient read failure", () => {
    fixture.query.error = new ApiClientError("Unavailable", 503);
    fixture.query.isError = true;
    const markup = renderShell();
    expect(markup).toContain("Authorized business");
    expect(markup).toContain("remote.stale");
    expect(markup).toContain('href="/operate/sales"');
  });

  test.each([
    ["/operate/sales/correct/record", "/operate/sales"],
    ["/billing/success", "/billing"],
    ["/settings", "/settings"],
  ])("marks the current destination for %s", (pathname, expected) => {
    fixture.pathname = pathname;
    const current = links(renderShell()).filter(({ tag }) => tag?.includes('aria-current="page"'));
    expect(current.map(({ href }) => href)).toEqual([expected]);
  });

  test("does not select a route with a similar prefix", () => {
    fixture.pathname = "/operate/sales-archive";
    const sale = links(renderShell()).find(({ href }) => href === "/operate/sales");
    expect(sale?.tag).not.toContain('aria-current="page"');
    expect(sale?.tag).not.toContain('aria-selected="true"');
  });

  test.each([320, 1440])("preserves busy sign-out, errors and appearance at width %s", (width) => {
    fixture.width = width;
    fixture.pending = true;
    fixture.error = "The session could not be closed.";
    const markup = renderShell();
    expect(markup).toContain("shell.signingOut");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(fixture.error);
    expect(markup).toContain("appearance-control");
    expect(markup).toContain("Route content");
  });

  test("wires link activation to compact navigation dismissal, including the same route", () => {
    const onNavigate = vi.fn();
    const link = SidebarLink({
      active: true,
      current: true,
      href: "/operate/sales",
      label: "Sales",
      onNavigate,
    });
    const button = link.props.children as ReactElement<
      ComponentProps<typeof import("./ui/button").Button>
    >;
    button.props.onPress?.({} as never);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(button.props.accessibilityRole).toBe("link");
  });
});
