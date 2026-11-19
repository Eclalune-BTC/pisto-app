import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type roles `global.css` adds to the theme. tailwind-merge reads an unknown `text-*` class
 * as a colour and would drop the real colour beside it, so every role is declared as a font size.
 */
export const TEXT_ROLES = [
  "micro",
  "dense",
  "title",
  "title-lg",
  "figure",
  "figure-lg",
  "figure-xl",
  "heading",
  "headline",
  "display-sm",
  "display",
  "display-lg",
  "display-xl",
] as const;

const merge = extendTailwindMerge({ extend: { theme: { text: [...TEXT_ROLES] } } });

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
