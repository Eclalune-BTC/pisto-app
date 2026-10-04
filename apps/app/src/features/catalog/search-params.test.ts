import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as (() => (() => void) | undefined)[],
  cleanups: [] as (() => void)[],
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => (() => void) | undefined) => hooks.effects.push(effect),
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++;
    hooks.refs[index] ??= { current: initial };
    return hooks.refs[index];
  },
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (value: unknown) => {
        hooks.states[index] = value;
      },
    ];
  },
}));

import {
  parseCategoryParam,
  parseLowStockParam,
  parseSearchParam,
  parseStatusParam,
  SEARCH_DEBOUNCE_MS,
  searchParam,
  statusParam,
  useSearchInput,
} from "./search-params";

beforeEach(() => {
  vi.useFakeTimers();
  hooks.states = [];
  hooks.refs = [];
});
afterEach(() => vi.useRealTimers());

/** Calls the hook the way a component render would, with the mocked React state above. */
function SearchInputHarness(props: {
  commit: (search: string | undefined) => void;
  committed: string;
}) {
  return useSearchInput(props.committed, props.commit);
}

function render(committed: string, commit: (search: string | undefined) => void) {
  for (const cleanup of hooks.cleanups.splice(0)) cleanup();
  hooks.index = 0;
  hooks.refIndex = 0;
  hooks.effects = [];
  const result = SearchInputHarness({ commit, committed });
  for (const effect of hooks.effects) {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  }
  return result;
}

describe("catalog URL filters", () => {
  test("falls back to the default view for an absent or unknown value", () => {
    expect(parseStatusParam(undefined)).toBe("active");
    expect(parseStatusParam("deleted")).toBe("active");
    expect(parseStatusParam(["archived", "all"])).toBe("archived");
    expect(statusParam("active")).toBeUndefined();
    expect(statusParam("all")).toBe("all");
    expect(parseLowStockParam("1")).toBe(true);
    expect(parseLowStockParam("true")).toBe(false);
  });

  test("drops a category that is not a record identifier", () => {
    expect(parseCategoryParam("not-a-category")).toBeNull();
    expect(parseCategoryParam("2f7a8e9c-0d1e-4b2a-9c3d-4e5f6a7b8c9d")).toBe(
      "2f7a8e9c-0d1e-4b2a-9c3d-4e5f6a7b8c9d",
    );
  });

  test("keeps a search the server accepts and leaves an empty one out of the URL", () => {
    expect(parseSearchParam("  café  ")).toBe("café");
    expect(parseSearchParam("x".repeat(200))).toHaveLength(120);
    expect(searchParam("   ")).toBeUndefined();
    expect(searchParam(" café ")).toBe("café");
  });

  test("commits the typed search to the URL only after a pause", () => {
    const commit = vi.fn();
    const [, setInput] = render("", commit);
    setInput("ca");
    render("", commit);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    setInput("café ");
    render("", commit);
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledExactlyOnceWith("café");

    // The committed value comes back without the trailing space still being typed.
    const [input] = render("café", commit);
    expect(input).toBe("café ");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  test("replaces the text when the URL changes from elsewhere", () => {
    const commit = vi.fn();
    const [, setInput] = render("café", commit);
    setInput("café molido");
    render("café", commit);
    // React renders again at once after a state change made while rendering.
    render("", commit);
    const [input] = render("", commit);
    expect(input).toBe("");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(commit).not.toHaveBeenCalled();
  });
});
