import { describe, expect, test } from "vitest";

import { transcriptSegments } from "./transcript-segments";

describe("transcriptSegments", () => {
  test("splits around located fragments and keeps their markers", () => {
    const text = "Le vendí a don Carlos tres libras de café";
    expect(
      transcriptSegments(text, [
        { start: 22, end: 41, field: "product", marker: 2 },
        { start: 3, end: 8, field: "kind", marker: 1 },
      ]),
    ).toEqual([
      { text: "Le ", marker: null },
      { text: "vendí", marker: 1 },
      { text: " a don Carlos ", marker: null },
      { text: "tres libras de café", marker: 2 },
    ]);
  });

  test("drops overlapping and out-of-range spans instead of duplicating text", () => {
    expect(
      transcriptSegments("pagué la luz", [
        { start: 0, end: 5, field: "kind", marker: 1 },
        { start: 3, end: 8, field: "amount", marker: 2 },
        { start: 9, end: 40, field: "category", marker: 3 },
      ]),
    ).toEqual([
      { text: "pagué", marker: 1 },
      { text: " la luz", marker: null },
    ]);
  });
});
