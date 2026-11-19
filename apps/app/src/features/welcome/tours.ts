/**
 * The two films of "Cómo funciona". Chapter starts are the seconds where the film's own chapter
 * begins; the captions file of each film carries a cue at every one of them.
 */
export const TOURS = {
  app: {
    video: "/media/coco-demo.mp4",
    poster: "/media/coco-demo.jpg",
    captions: "/media/coco-demo.vtt",
    duration: "1:06",
    chapters: [
      { id: "today", start: 0 },
      { id: "dictate", start: 9 },
      { id: "ask", start: 23 },
      { id: "money", start: 36 },
      { id: "stock", start: 46 },
      { id: "reports", start: 56 },
    ],
  },
  sale: {
    video: "/media/venta-de-cafe.mp4",
    poster: "/media/venta-de-cafe.jpg",
    captions: "/media/venta-de-cafe.vtt",
    duration: "0:18",
    chapters: [
      { id: "product", start: 0 },
      { id: "payment", start: 8 },
      { id: "receipt", start: 13 },
    ],
  },
} as const;

export type TourId = keyof typeof TOURS;
export const TOUR_IDS = Object.keys(TOURS) as TourId[];

export type ChapterId<Tour extends TourId = TourId> =
  (typeof TOURS)[Tour]["chapters"][number]["id"];

export function firstChapter(tour: TourId): ChapterId {
  return TOURS[tour].chapters[0].id;
}

/** The chapter playing at `seconds`: the last one that has already started. */
export function chapterAt(tour: TourId, seconds: number): ChapterId {
  let current: ChapterId = firstChapter(tour);
  for (const chapter of TOURS[tour].chapters) {
    if (seconds >= chapter.start) current = chapter.id;
  }
  return current;
}

export function chapterStart(tour: TourId, chapter: ChapterId): number {
  const found = TOURS[tour].chapters.find((entry) => entry.id === chapter);
  if (!found) throw new Error(`The ${tour} film has no chapter ${chapter}`);
  return found.start;
}
