import { Platform } from "react-native";

/**
 * The control that is opening a dialog, read before the dialog takes focus. A menu item leaves
 * with its menu, so the menu's trigger stands in for it.
 */
export function focusReturnTarget(): HTMLElement | null {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  const triggerId = active.closest('[role="menu"]')?.getAttribute("aria-labelledby");
  return (triggerId ? document.getElementById(triggerId) : null) ?? active;
}

/**
 * Radix returns focus to a dialog's own trigger, and these dialogs open from rows and menus
 * without one; focus goes back to the captured control while it is still on the page.
 */
export function returnFocusOnClose(target: HTMLElement | null | undefined) {
  return (event: Event) => {
    event.preventDefault();
    if (target?.isConnected) target.focus();
  };
}
