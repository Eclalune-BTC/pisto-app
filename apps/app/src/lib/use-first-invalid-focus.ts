import { useRef } from "react";
import { Platform, type View } from "react-native";

/**
 * Moves focus to the first invalid control after a failed review attempt, so keyboard and screen
 * reader users land on what needs fixing. Web only: native fields announce their own errors.
 */
export function useFirstInvalidFocus() {
  const containerRef = useRef<View>(null);
  const focusFirstInvalid = () => {
    if (Platform.OS !== "web") return;
    // Runs after the commit that marks the invalid controls.
    setTimeout(() => {
      const root = containerRef.current as unknown as HTMLElement | null;
      root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, 0);
  };
  return { containerRef, focusFirstInvalid };
}
