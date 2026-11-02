import type { entrySourceSchema } from "@pisto/contracts";
import type { z } from "zod";

/** How a record was captured: a form, a dictated transcript or a typed message. */
export type EntrySource = z.infer<typeof entrySourceSchema>;
