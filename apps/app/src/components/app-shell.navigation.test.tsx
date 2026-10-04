import { QueryClient } from "@tanstack/react-query";
import { cloneElement, createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { beforeEach, describe, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  user: { email: "owner@example.test", name: "Owner Name" } as {
    email: string;
    name: string;
  } | null,
  pathname: "/operate",
  segments: ["(app)", "operate"] as string[],
  width: 1440,
  query: {} as Record<string, unknown>,
  pending: false,
  error: undefined as string | undefined,
  signOut: vi.fn(),
  sheet: {} as Record<string, unknown>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => fixture.query,
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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
  useSegments: () => fixture.segments,
  useGlobalSearchParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children: ReactElement<Record<string, unknown>>; href: string }) =>
    cloneElement(children, { href, accessibilityRole: "link" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("uniwind", () => ({
  withUniwind: (component: unknown) => component,
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#1c1917") : "#1c1917",
  useUniwind: () => ({ theme: "light" }),
}));
vi.mock("@/hooks/use-sign-out", () => ({
  useSignOut: () => ({
    isPending: fixture.pending,
    error: fixture.error,
    signOut: fixture.signOut,
  }),
}));
vi.mock("@/providers/appearance-provider", () => ({
  useAppearance: () => ({ choice: "system", issue: null, pending: false, select: vi.fn() }),
}));
vi.mock("@/lib/appearance-preference", () => ({ parseAppearanceChoice: (value: string) => value }));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ api: { businesses: { list: vi.fn() } } }));
vi.mock("@/lib/auth-client", () => ({ authClient: { organization: { setActive: vi.fn() } } }));
vi.mock("@/components/ui/avatar", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => children ?? null;
  return { Avatar: passthrough, AvatarFallback: passthrough };
});

// Menus and the compact sheet render their content so the static markup exposes every action;
// focus, Escape and positioning belong to the browser validation of the real primitives.
vi.mock("@/components/ui/dropdown-menu", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: ({ children }: { children: ReactNode }) =>
      createElement("section", { "data-testid": "menu" }, children),
    DropdownMenuGroup: passthrough,
    DropdownMenuLabel: passthrough,
    DropdownMenuRadioGroup: passthrough,
    DropdownMenuRadioItem: passthrough,
    DropdownMenuSeparator: () => createElement("hr"),
    DropdownMenuItem: ({ children, disabled }: { children: ReactNode; disabled?: boolean }) =>
      createElement("div", { role: "menuitem", "aria-disabled": disabled }, children),
  };
});
vi.mock("@/components/ui/sheet", () => ({
  Sheet: (props: Record<string, unknown> & { children: ReactNode }) => {
    fixture.sheet = props;
    return props.children;
  },
  SheetContent: ({ children }: { children: ReactNode }) =>
    createElement("section", { "data-testid": "navigation-sheet" }, children),
  SheetTitle: ({ children }: { children: ReactNode }) => children,
}));

import { AppShell } from "@/components/app-shell";
import { OPERATE_MODULES } from "@/features/operate/navigation";
import { ApiClientError } from "@/lib/api-error";

function renderShell() {
  return renderToStaticMarkup(
    createElement(AppShell, { user: fixture.user }, createElement(Text, {}, "Route content")),
  );
}

function links(markup: string) {
  return [...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(([tag, href]) => ({
    tag,
    href,
  }));
}

function navigationLinks(markup: string) {
  return links(markup)
    .map(({ href }) => href ?? "")
    .filter((href) => href.startsWith("/operate"));
}

const allModuleLinks = ["/operate", ...OPERATE_MODULES.map(({ href }) => String(href))];

function business(id: string, name: string, permissions: readonly string[]) {
  return { id, name, currency: "USD", access: { permissions } };
}

beforeEach(() => {
  fixture.user = { email: "owner@example.test", name: "Owner Name" };
  fixture.pathname = "/operate";
  fixture.segments = ["(app)", "operate"];
  fixture.width = 1440;
  fixture.pending = false;
  fixture.error = undefined;
  fixture.signOut.mockClear();
  fixture.sheet = {};
  fixture.query = {
    data: {
      activeBusinessId: "business-a",
      items: [
        business(
          "business-a",
          "Authorized business",
          OPERATE_MODULES.map(({ permission }) => permission),
        ),
      ],
    },
    error: null,
    isError: false,
    isPending: false,
    fetchStatus: "idle",
  };
});

describe("application shell", () => {
  test("renders grouped module navigation, the business and the account menu on wide screens", () => {
    const markup = renderShell();
    expect(navigationLinks(markup)).toEqual(allModuleLinks);
    expect(markup).toContain("Authorized business");
    expect(markup).toContain("shell.userMenu");
    expect(markup).toContain("common.account");
    expect(markup).toContain("settings.billing");
    expect(markup).toContain("common.signOut");
    expect(markup).toContain("Route content");
    expect(markup).not.toContain('data-testid="navigation-sheet"');
  });

  test("moves the same navigation into a closed sheet on compact screens", () => {
    fixture.width = 390;
    const markup = renderShell();
    expect(markup).toContain('aria-label="shell.openNavigation"');
    expect(markup).toContain('data-testid="navigation-sheet"');
    expect(navigationLinks(markup)).toEqual(allModuleLinks);
    expect(fixture.sheet.open).toBe(false);
    expect(fixture.sheet.onOpenChange).toBeTypeOf("function");
  });

  test("exposes only the active membership's permitted modules", () => {
    fixture.query.data = {
      activeBusinessId: "business-b",
      items: [
        business("business-a", "Other business", ["sales:read", "cash:read", "reports:read"]),
        business("business-b", "Current business", ["sales:read", "catalog:read"]),
      ],
    };
    const markup = renderShell();
    expect(navigationLinks(markup)).toEqual(["/operate", "/operate/sales", "/operate/catalog"]);
    expect(markup).toContain("Current business");
  });

  test.each([undefined, { activeBusinessId: null, items: [] }])(
    "does not invent module links without a resolved business (%j)",
    (data) => {
      fixture.query.data = data;
      expect(navigationLinks(renderShell())).toEqual(["/operate"]);
    },
  );

  test.each([401, 403])(
    "hides cached business identity and modules after HTTP %s",
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
      fixture.query = { ...query, isError: true };
      for (const width of [390, 1440]) {
        fixture.width = width;
        const markup = renderShell();
        expect(markup).not.toContain("Authorized business");
        expect(navigationLinks(markup)).toEqual(["/operate"]);
        expect(markup).toContain("common.signOut");
      }
      client.clear();
    },
  );

  test("keeps and labels cached navigation during a transient read failure", () => {
    fixture.query.error = new ApiClientError("Unavailable", 503);
    fixture.query.isError = true;
    const markup = renderShell();
    expect(markup).toContain("Authorized business");
    expect(markup).toContain("shell.businessStale");
    expect(navigationLinks(markup)).toEqual(allModuleLinks);
  });

  test.each([
    [
      "/operate/sales/correct/record",
      ["(app)", "operate", "sales", "correct", "[saleId]"],
      "/operate/sales",
    ],
    ["/operate", ["(app)", "operate"], "/operate"],
  ])("marks exactly one current destination for %s", (pathname, segments, expected) => {
    fixture.pathname = pathname;
    fixture.segments = segments;
    const current = links(renderShell()).filter(({ tag }) => tag.includes('aria-current="page"'));
    expect(current.map(({ href }) => href)).toEqual([expected]);
  });

  test("does not select a route that only shares a prefix", () => {
    fixture.pathname = "/operate/sales-archive";
    const sale = links(renderShell()).find(({ href }) => href === "/operate/sales");
    expect(sale?.tag).not.toContain('aria-current="page"');
  });

  test("links every breadcrumb ancestor and names the business at the root", () => {
    fixture.pathname = "/operate/sales/correct/sale-1";
    fixture.segments = ["(app)", "operate", "sales", "correct", "[saleId]"];
    const markup = renderShell();
    expect(markup).toContain('aria-label="shell.breadcrumb"');
    expect(markup).toContain("shell.routes./operate/sales/correct/[saleId]");
  });

  test("keeps the frame and its navigation shape while the session and access restore", () => {
    fixture.user = null;
    fixture.query = {
      data: undefined,
      error: null,
      isError: false,
      isPending: true,
      fetchStatus: "fetching",
    };
    const markup = renderShell();
    expect(markup).toContain("Route content");
    expect(markup).not.toContain("shell.userMenu");
    expect(navigationLinks(markup)).toEqual(["/operate"]);
    expect(markup.match(/aria-hidden="true"/g)?.length ?? 0).toBeGreaterThan(1);
  });

  test.each([390, 1440])("keeps busy and failed sign-out visible at width %s", (width) => {
    fixture.width = width;
    fixture.pending = true;
    fixture.error = "The session could not be closed.";
    const markup = renderShell();
    expect(markup).toContain("shell.signingOut");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(fixture.error);
  });
});
