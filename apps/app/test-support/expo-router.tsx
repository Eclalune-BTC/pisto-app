import { cloneElement, isValidElement, type PropsWithChildren, type ReactElement } from "react";

// Node tests cannot load Expo Router's React Native sources. Files that exercise navigation
// replace this stub with their own vi.mock and assert on the calls they need.
const router = {
  back: () => undefined,
  dismissTo: () => undefined,
  navigate: () => undefined,
  push: () => undefined,
  replace: () => undefined,
};

export function Link({
  asChild,
  children,
  href,
}: PropsWithChildren<{ asChild?: boolean; href: unknown }>) {
  const target = typeof href === "string" ? href : JSON.stringify(href);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<Record<string, unknown>>, {
      accessibilityRole: "link",
      href: target,
    });
  }
  return <a href={target}>{children}</a>;
}

export const useRouter = () => router;
export const usePathname = () => "/";
export const useSegments = () => [];
export const useGlobalSearchParams = () => ({});
export const useLocalSearchParams = () => ({});
export const Redirect = () => null;
export function Slot() {
  return null;
}
