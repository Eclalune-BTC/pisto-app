import { uuidSchema } from "@pisto/contracts";
import { useEffect, useRef, useState } from "react";
import { firstParam, type RouteParam } from "../cash/search-params";
import type { CatalogStatusFilter } from "./queries";

export const SEARCH_DEBOUNCE_MS = 300;
/** The server rejects longer searches; the input stops there. */
export const SEARCH_MAX_LENGTH = 120;

const statuses: readonly CatalogStatusFilter[] = ["active", "archived", "all"];

/** An absent or unknown value means the default view: active records. */
export function parseStatusParam(value: RouteParam): CatalogStatusFilter {
  const status = firstParam(value);
  return statuses.find((candidate) => candidate === status) ?? "active";
}

export function statusParam(status: CatalogStatusFilter): string | undefined {
  return status === "active" ? undefined : status;
}

export function parseSearchParam(value: RouteParam): string {
  return (firstParam(value) ?? "").trim().slice(0, SEARCH_MAX_LENGTH);
}

export function searchParam(search: string): string | undefined {
  return search.trim() || undefined;
}

/** A category filter that is not a record identifier is dropped instead of sent to the server. */
export function parseCategoryParam(value: RouteParam): string | null {
  const parsed = uuidSchema.safeParse(firstParam(value));
  return parsed.success ? parsed.data : null;
}

export function parseLowStockParam(value: RouteParam): boolean {
  return firstParam(value) === "1";
}

/**
 * The text of a search box whose committed value lives in the URL. Typing updates the box at
 * once and the URL after a pause; a URL change from elsewhere, such as clearing the filters,
 * replaces the text unless it only differs by surrounding spaces still being typed.
 */
export function useSearchInput(committed: string, commit: (search: string | undefined) => void) {
  const [input, setInput] = useState(committed);
  const [synced, setSynced] = useState(committed);
  // A new callback identity on each render must not restart the pause.
  const latestCommit = useRef(commit);
  useEffect(() => {
    latestCommit.current = commit;
  });
  if (committed !== synced) {
    setSynced(committed);
    if (committed !== input.trim()) setInput(committed);
  }
  useEffect(() => {
    const next = input.trim();
    if (next === committed) return;
    const timer = setTimeout(() => latestCommit.current(searchParam(next)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [committed, input]);
  return [input, setInput] as const;
}
