import type { AssistantInterpretation } from "@pisto/contracts";
import { useSyncExternalStore } from "react";

/**
 * The interpretation under review lives in memory only: it holds names and amounts, so it is never
 * written to the URL or to storage, and a reload starts over.
 */
export type ReviewEntry = {
  businessId: string;
  interpretation: AssistantInterpretation;
  /** Increases with every new interpretation, so editors seeded from the last one start over. */
  revision: number;
};

let current: ReviewEntry | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export const reviewStore = {
  get: () => current,
  set(entry: Omit<ReviewEntry, "revision">) {
    revision += 1;
    current = { ...entry, revision };
    emit();
  },
  clear() {
    current = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The entry of this business only; another business's draft is never shown. */
export function useReviewEntry(businessId: string | undefined): ReviewEntry | null {
  const entry = useSyncExternalStore(reviewStore.subscribe, reviewStore.get, reviewStore.get);
  return entry && entry.businessId === businessId ? entry : null;
}
