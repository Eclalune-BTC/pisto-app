import type { AssistantSpan } from "@pisto/contracts";

export type TranscriptSegment = { text: string; marker: number | null };

/** Splits text at the spans, dropping spans that overlap an earlier one or fall outside the text. */
export function transcriptSegments(
  text: string,
  spans: readonly AssistantSpan[],
): TranscriptSegment[] {
  const ordered = [...spans]
    .filter((span) => span.start >= 0 && span.end <= text.length && span.end > span.start)
    .sort((left, right) => left.start - right.start);
  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue;
    if (span.start > cursor) segments.push({ text: text.slice(cursor, span.start), marker: null });
    segments.push({ text: text.slice(span.start, span.end), marker: span.marker });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marker: null });
  return segments;
}
