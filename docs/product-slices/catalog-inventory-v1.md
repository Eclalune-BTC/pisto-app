# Catalog and inventory V1

- Status: **integrated into `main`; schema ships in migration `0003` and the routes are mounted under `/v1`**
- Owner: `@pisto/contracts`, `@pisto/db`, `@pisto/api`, and the Expo `catalog`/`inventory` features
- Last reviewed: **2026-08-22**
- Parent contract: [Operating core V1](operating-core-v1.md#catalog-and-inventory-slice)

## User job and end state

An authenticated owner or admin can create and maintain categories and products, then record exact
stock entering or leaving a tracked product. A member can search active catalog records, read product
detail, see the derived on-hand balance, low-stock state, and movement history. The end state is a
persisted reference record plus, for stock changes, an append-only movement and operation receipt.
No screen or API edits a stored quantity-on-hand field because no such field exists.

## Prerequisites and composition

- Better Auth proves the current session and organization membership.
- The active organization-backed `businessId` is resolved from the fresh session; request bodies,
  route parameters, models, and clients never select an authorization tenant.
- `business_settings` owns the user-selected operating currency, its resolved minor-unit digits, and
  IANA time zone.
- `@pisto/app` and `@pisto/api` explicitly register routes, navigation, localization, and repositories.
  This slice does not self-register or add a top-level destination.
- The structured destinations remain `/operate/catalog` and `/operate/inventory` under `Operate`.
  The feature branch provides route-ready feature components; the integration owner supplies the
  small Expo Router wrappers and typed `es-SV` copy at the shared composition boundary.

## Canonical data ownership

### Category

`catalog_category` owns a business-scoped UUID, trimmed name, active/archived state, and timestamps.
Names are case-insensitively unique within one business. Archiving retains the row and all product
references; it does not free the name for an ambiguous replacement.

### Product

`catalog_product` owns a business-scoped UUID, optional active category reference, name, optional
case-insensitive business-unique SKU, optional selling price, unit kind, quantity precision, tracked
flag, optional low-stock threshold, active/archived state, and timestamps.

V1 unit kinds are the bounded product vocabulary `unit`, `kilogram`, `gram`, `liter`, `milliliter`,
and `meter`. Expanding that product vocabulary is a contract change, not an arbitrary free-text
fallback. Quantity precision is 0 through 3 decimal places.

The user chooses the business currency during business onboarding. No catalog route accepts a
currency. When a selling price is set, the server copies the current `business_settings.currency`
and `currency_minor_unit_digits` into the product price snapshot in the same transaction. A missing
price has all three price fields null. V1 does not convert currencies, and the parent operating-core
contract blocks a currency change after financial records exist.

### Inventory movement and operation receipt

`inventory_movement` is append-only. It records `receive`, `adjust_in`, `adjust_out`, or `reverse`, a
positive quantity, signed derived delta, quantity-precision snapshot, reason, confirmed local
date/minute, resolved instant, IANA zone, actor, optional reversal link, and creation time.

Quantities cross JSON as canonical integer strings in fixed-scale minor quantity units. For example,
`1.250` kilograms at precision 3 is `"1250"`; JavaScript floating point never owns the canonical
quantity. On-hand is the exact sum of signed movement deltas. A reverse movement negates one original
movement and links to it; a database uniqueness constraint permits one reversal only.

`catalog_operation` binds one actor, business, UUID idempotency key, versioned command fingerprint,
action, target, and immutable result snapshot. An exact replay returns that original snapshot even if
the mutable product or category changed later. Reusing the key with changed action or input returns
`IDEMPOTENCY_CONFLICT`.

## Commands and invariants

All writes reject unknown fields, load fresh session and membership access, acquire one transaction,
lock the idempotency identity, validate deterministic domain rules, write the record and operation
receipt atomically, and return the actual committed result.

- Create, update, and archive category.
- Create, update, and archive product.
- Record `receive`, `adjust_in`, or `adjust_out` for an active tracked product.
- Reverse one non-reversal movement once.

Movement commands lock the product row before reading the current sum. All movement commands for one
product therefore serialize around the no-negative-stock invariant. An outbound movement or reversal
that would produce a negative tracked balance conflicts. Different idempotency keys cannot race past
that check.

Quantity precision and tracking cannot change after movement history exists because reinterpreting or
hiding prior fixed-scale history would corrupt meaning. An archived product rejects updates and new
inventory mutations. History and detail remain readable. Reversing a reversal is rejected rather than
creating an unbounded correction chain.

## Queries and HTTP contract

All routes use the existing `{ data: ... }` success envelope and stable error envelope. Lists default
to 25, accept 1 through 50, use an opaque creation-time/UUID cursor, and reject invalid or cross-list
cursors.

| Method | Path | Permission | Result |
| --- | --- | --- | --- |
| `GET`, `POST` | `/v1/catalog/categories` | `catalog:read` / `catalog:manage` | Search/list or create |
| `PATCH` | `/v1/catalog/categories/:categoryId` | `catalog:manage` | Update |
| `POST` | `/v1/catalog/categories/:categoryId/archive` | `catalog:manage` | Archive |
| `GET`, `POST` | `/v1/catalog/products` | `catalog:read` / `catalog:manage` | Search/list or create |
| `GET`, `PATCH` | `/v1/catalog/products/:productId` | `catalog:read` / `catalog:manage` | Detail or update |
| `POST` | `/v1/catalog/products/:productId/archive` | `catalog:manage` | Archive |
| `GET` | `/v1/inventory/stock` | `inventory:read` | Derived stock, optionally low-only |
| `GET`, `POST` | `/v1/inventory/products/:productId/movements` | `inventory:read` / `inventory:manage` | History or append |
| `POST` | `/v1/inventory/movements/:movementId/reverse` | `inventory:manage` | Append one reversal |

Owner and admin receive read/manage access. Member receives catalog and inventory read access only.
Unknown or composed role strings fail closed. Cross-business detail and movement identifiers return
`NOT_FOUND`; they do not disclose another tenant's record.

## Product surfaces and state contract

The Expo feature components share web/native semantics and use responsive React Native layout. They
receive typed localized copy instead of embedding visible fallback strings. The integration owner
connects them to React Query, business access, and Expo Router.

- Catalog list: search, category filter, active/archived state, price snapshot, stock summary, and an
  owned create action only when `catalog:manage` is present.
- Product editor: category, SKU, price, bounded unit, precision, tracking, and threshold with a
  separate review/confirm step and one persistent idempotency key per reviewed command.
- Product detail: canonical fields, edit, explicit archive review, and uncertain-confirmation recovery.
- Inventory list: search, low-stock filter, exact derived quantity, and threshold.
- Movement editor/history: receive/adjust review, exact date/time/zone meaning, signed history,
  reversal relationship, and explicit reversal review.

Loading, successful empty, stale, offline, denied, validation, conflict, error, and retry states are
distinct. A connection loss after a mutation becomes `uncertain`; the UI does not generate a new key
or claim failure/success. It directs the route controller to resolve the original operation by replay
or refreshed canonical data. No fake products, balances, thresholds, or success states are rendered.

The surfaces preserve Pisto's ink/lime/cream palette and use type, spacing, dividers, and direct row
interaction. There are no decorative glows, gradients, floating cards, ornamental pills, fake
metrics, or unowned action buttons.

## Failure model

- `400 VALIDATION_ERROR`: malformed UUID command payload, precision, local date/minute, cursor, limit,
  category, unit, quantity, reason, or unsupported shape.
- `401 UNAUTHORIZED`: missing or expired fresh session.
- `403 FORBIDDEN`: selected-business membership lacks the exact read/manage permission.
- `404 NOT_FOUND`: record is absent from the selected business or intentionally undisclosed.
- `409 CONFLICT`: duplicate category name/SKU, archived mutation, untracked stock mutation,
  insufficient stock, repeated/invalid reversal, or precision/tracking history conflict.
- `409 IDEMPOTENCY_CONFLICT`: one actor/business key was previously bound to changed input.

An empty list is a successful empty result. A failed query never becomes empty data or a zero balance.

## Evidence and integration seams

Focused tests cover strict contracts, fixed-scale parsing, currency snapshots, schema ownership,
route validation/status mapping, role denial, tenant isolation, exact replay/conflict, concurrent
negative-stock protection, reversal once, precision history, low stock, archived records, and
uncertain UI state inputs. The suite in `packages/db/integration/catalog.integration.ts` also passes
against an isolated PostgreSQL 18 database containing the existing migrations plus this schema.

The integration owner must still generate and review the shared migration. In that migration, create
the composite unique indexes on category, product, and movement tenant keys before adding foreign
keys that reference those columns; PostgreSQL requires the referenced uniqueness to exist first.

The integration owner still owns these shared edits:

1. export `catalog.ts` from the contract and database barrels;
2. add the four tables to the shared Drizzle schema and generate/review one migration;
3. instantiate `createCatalogRepository` and mount `catalogRoutes` under `/v1`;
4. add Expo Router wrappers, Operate navigation, typed `es-SV` resources, and React Query controllers;
5. verify compact web, wide web, iOS, and Android behavior; and
6. run the combined repository, migration, PostgreSQL, browser, and native gates.

## Non-goals

Variants, bundles, barcodes, suppliers, purchase orders, cost layers, taxes, automatic sale stock
deduction, offline writes, currency conversion, and hidden overdraft/backorder behavior are excluded.

## Primary sources

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL 18 numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
- [Drizzle ORM indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Drizzle ORM transactions](https://orm.drizzle.team/docs/transactions)
- [Expo Router file-based routing](https://docs.expo.dev/router/introduction/)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
