import { Platform } from "react-native";
import { focusReturnTarget } from "@/lib/focus-return";

/**
 * The title of the screen that holds `control`, focusable from script. The search walks up from
 * the control because screens kept mounted behind it have titles of their own.
 */
export function screenHeadingOf(control: HTMLElement | null): HTMLElement | null {
  if (Platform.OS !== "web" || !control) return null;
  for (let node = control.parentElement; node; node = node.parentElement) {
    const heading = node.querySelector<HTMLElement>('h1, [role="heading"][aria-level="1"]');
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      return heading;
    }
  }
  return null;
}

/** Where focus can go when a dialog closes, captured while its opener still has focus. */
export type DialogFocus = { opener: HTMLElement | null; title: HTMLElement | null };

export function captureDialogFocus(): DialogFocus {
  const opener = focusReturnTarget();
  return { opener, title: screenHeadingOf(opener) };
}

/**
 * The opener, unless a confirmed archive or reversal took it off the page with the action it
 * offered; focus then continues from the screen's title instead of the start of the document.
 */
export function dialogReturnFocus(focus: DialogFocus, confirmed: boolean): HTMLElement | null {
  return confirmed ? focus.title : focus.opener;
}
