import { type BusinessRepository, createBusinessRepository } from "./businesses.ts";
import type { Database } from "./client.ts";
import { createSalesRepository, type SalesRepository } from "./sales.ts";

export interface ProductRepository extends BusinessRepository, SalesRepository {}

export function createProductRepository(db: Database): ProductRepository {
  return { ...createBusinessRepository(db), ...createSalesRepository(db) };
}
