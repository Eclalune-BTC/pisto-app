import { z } from "zod";

import { timestampSchema, uuidSchema } from "./primitives";

/** The business areas whose data a committed change can affect. */
export const businessChangeResourceSchema = z.enum([
  "sales",
  "catalog",
  "inventory",
  "cash",
  "expenses",
  "customers",
  "receivables",
  "purchases",
  "members",
]);

/**
 * Messages sent over `/v1/realtime`. A change notice names what changed, never the changed
 * records: clients refetch through the normal authorized endpoints.
 */
export const realtimeServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), businessId: uuidSchema }).strict(),
  z
    .object({
      type: z.literal("business.changed"),
      businessId: uuidSchema,
      resource: businessChangeResourceSchema,
      at: timestampSchema,
    })
    .strict(),
  z.object({ type: z.literal("pong") }).strict(),
]);

/** Clients send a heartbeat so idle proxies keep the socket open. */
export const realtimeClientMessageSchema = z.object({ type: z.literal("ping") }).strict();

export type BusinessChangeResource = z.infer<typeof businessChangeResourceSchema>;
export type RealtimeServerMessage = z.infer<typeof realtimeServerMessageSchema>;
export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;
