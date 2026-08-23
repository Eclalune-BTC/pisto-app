import type { SaleCorrection, SaleList, SaleListQuery, SaleStatusFilter } from "@pisto/contracts";
import { saleListQuerySchema } from "@pisto/contracts";
import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";

import { authorizeBusinessAction } from "./business-access.ts";
import type { Database } from "./client.ts";
import { fingerprintValue } from "./operation-log.ts";
import { type ProductActor, ProductError } from "./product-core.ts";
import { toCorrection, toSale } from "./sales-records.ts";
import { sale, saleCorrection } from "./schema/sales.ts";

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SaleListCursor = {
  createdAt: string;
  filterFingerprint: string;
  id: string;
  version: 1;
};

export interface SalesQueryRepository {
  listSales(actor: ProductActor, query: SaleListQuery): Promise<SaleList>;
}

/**
 * Binds a cursor to the filters that produced it. Replaying a cursor under
 * different filters would silently skip or repeat rows, so the fingerprint makes
 * that a validation failure instead of a plausible-looking page.
 */
export function saleListFilterFingerprint(status: SaleStatusFilter): Promise<string> {
  return fingerprintValue({ kind: "sales", status, version: 1 });
}

export function encodeSaleListCursor(cursor: SaleListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSaleListCursor(
  value: string,
  expectedFilterFingerprint: string,
): SaleListCursor {
  try {
    if (!base64UrlPattern.test(value)) throw new Error("Cursor is not base64url");
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("createdAt" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      new Date(parsed.createdAt).toISOString() !== parsed.createdAt ||
      !("id" in parsed) ||
      typeof parsed.id !== "string" ||
      !uuidPattern.test(parsed.id) ||
      !("filterFingerprint" in parsed) ||
      parsed.filterFingerprint !== expectedFilterFingerprint
    ) {
      throw new Error("Invalid cursor payload");
    }
    return parsed as SaleListCursor;
  } catch {
    throw new ProductError("VALIDATION_ERROR", "The page cursor is invalid for this query");
  }
}

export function createSalesQueryRepository(db: Database): SalesQueryRepository {
  return {
    async listSales(actor, rawQuery) {
      const parsed = saleListQuerySchema.safeParse(rawQuery);
      if (!parsed.success) {
        throw new ProductError("VALIDATION_ERROR", "Sale list filters are invalid");
      }
      const query = parsed.data;
      const filterFingerprint = await saleListFilterFingerprint(query.status);
      const cursor = query.cursor ? decodeSaleListCursor(query.cursor, filterFingerprint) : null;

      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:read"], "share");
        const conditions: SQL[] = [eq(sale.businessId, access.businessId)];
        if (query.status !== "all") conditions.push(eq(sale.status, query.status));
        if (cursor) {
          const createdAt = new Date(cursor.createdAt);
          conditions.push(
            or(
              lt(sale.createdAt, createdAt),
              and(eq(sale.createdAt, createdAt), lt(sale.id, cursor.id)),
            ) as SQL,
          );
        }
        const rows = await tx
          .select()
          .from(sale)
          .where(and(...conditions))
          .orderBy(desc(sale.createdAt), desc(sale.id))
          .limit(query.limit + 1);
        const visible = rows.slice(0, query.limit);
        const pageIds = visible.map(({ id }) => id);
        // A sale is never both an original and a replacement, but only the
        // application enforces that. Joining the correction table could still fan
        // the page out, so the links are read separately over the page ids.
        const correctionRecords =
          pageIds.length === 0
            ? []
            : await tx
                .select()
                .from(saleCorrection)
                .where(
                  and(
                    eq(saleCorrection.businessId, access.businessId),
                    or(
                      inArray(saleCorrection.originalSaleId, pageIds),
                      inArray(saleCorrection.replacementSaleId, pageIds),
                    ),
                  ),
                );
        const correctionsBySaleId = new Map<string, SaleCorrection>();
        for (const record of correctionRecords) {
          const correction = toCorrection(record);
          correctionsBySaleId.set(record.originalSaleId, correction);
          if (record.replacementSaleId) {
            correctionsBySaleId.set(record.replacementSaleId, correction);
          }
        }
        const items = visible.map((record) => {
          const correction = correctionsBySaleId.get(record.id) ?? null;
          if (record.status === "voided" && correction === null) {
            throw new Error("A voided sale is missing its correction record");
          }
          return toSale(record, correction);
        });
        const last = visible.at(-1);
        return {
          items,
          nextCursor:
            rows.length > query.limit && last
              ? encodeSaleListCursor({
                  createdAt: last.createdAt.toISOString(),
                  filterFingerprint,
                  id: last.id,
                  version: 1,
                })
              : null,
          queriedAt: access.queriedAt.toISOString(),
        };
      });
    },
  };
}
