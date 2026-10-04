import type { RefObject } from "react";

/** The control that opened a dialog, which takes focus back when the dialog closes. */
export type FocusReturnRef = RefObject<{ focus: () => void } | null>;
