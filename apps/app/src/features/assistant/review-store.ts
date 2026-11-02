import type { AssistantInterpretation } from "@pisto/contracts";
import { useSyncExternalStore } from "react";

/**
 * The interpretation under review lives in memory only: it holds names and amounts, so it is never
 * written to the URL or to storage, and a reload starts over.
 */
export type ReviewEntry = {
  /** The signed-in user and business the draft was made for; nobody else ever sees it. */
  userId: string;
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

/** The entry of this user and business only; a shared device never shows another's draft. */
export function visibleEntry(
  entry: ReviewEntry | null,
  userId: string | undefined,
  businessId: string | undefined,
): ReviewEntry | null {
  return entry && entry.userId === userId && entry.businessId === businessId ? entry : null;
}

export function useReviewEntry(
  userId: string | undefined,
  businessId: string | undefined,
): ReviewEntry | null {
  const entry = useSyncExternalStore(reviewStore.subscribe, reviewStore.get, reviewStore.get);
  return visibleEntry(entry, userId, businessId);
}
