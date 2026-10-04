import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));

import { focusReturnTarget, returnFocusOnClose } from "./focus-return";

class FakeElement {
  constructor(private readonly menuTriggerId: string | null = null) {}
  closest() {
    return this.menuTriggerId ? { getAttribute: () => this.menuTriggerId } : null;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dialog focus return", () => {
  test("focuses the opener while it is on the page and always stops Radix's own move", () => {
    const event = { preventDefault: vi.fn() } as unknown as Event;
    const opener = { focus: vi.fn(), isConnected: true } as unknown as HTMLElement;
    returnFocusOnClose(opener)(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(opener.focus).toHaveBeenCalledOnce();

    const removed = { focus: vi.fn(), isConnected: false } as unknown as HTMLElement;
    returnFocusOnClose(removed)(event);
    expect(removed.focus).not.toHaveBeenCalled();
    expect(() => returnFocusOnClose(null)(event)).not.toThrow();
  });

  test("stands in a menu's trigger for the menu item that opened the dialog", () => {
    const trigger = new FakeElement();
    const item = new FakeElement("menu-trigger");
    const body = new FakeElement();
    vi.stubGlobal("HTMLElement", FakeElement);
    const document = (activeElement: FakeElement) => ({
      activeElement,
      body,
      getElementById: (id: string) => (id === "menu-trigger" ? trigger : null),
    });
    vi.stubGlobal("document", document(item));
    expect(focusReturnTarget()).toBe(trigger);
    vi.stubGlobal("document", document(trigger));
    expect(focusReturnTarget()).toBe(trigger);
    vi.stubGlobal("document", document(body));
    expect(focusReturnTarget()).toBeNull();
  });

  test("has nothing to restore without a document", () => {
    expect(focusReturnTarget()).toBeNull();
  });
});
