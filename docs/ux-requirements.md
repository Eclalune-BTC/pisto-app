# Manual operating UX requirements

- Scope: existing structured business, sales, catalog, stock, cash, expense, customer, receivable,
  and operating report routes. No new capability, permission, or navigation destination is implied.
- Owner: `apps/app`; authoritative records, validation, money, and tenancy retain their existing
  contract/API/PostgreSQL owners.
- Review date: 2026-09-10.

## Observable outcome

An authorized entrepreneur can find a record, change a filter or reporting period, inspect the
result, and recover from a failed read without losing the controls needed to finish the task.
Confirmations retain their visible action name and disabled/busy state while the server responds.
Existing financial review, idempotency, permission, and correction rules remain mandatory.

## Supported views and task paths

| Entry | Read controls and result | Existing action path |
| --- | --- | --- |
| `/operate` | Active business context and authorized module groups | Open a module or register a sale |
| `/operate/sales` | Previous-month summary and status-filtered, paginated history | New sale, canonical detail, reviewed void/replacement |
| `/operate/catalog` | Product search, status/category filters, price/stock details | Create/edit/archive a product; manage categories |
| `/operate/inventory` | Tracked products and low-stock filter | Product movements, receive/adjust, reviewed reversal |
| `/operate/cash` | Account status filter, canonical balances and movement history | Account detail, adjustment, transfer, archive/update |
| `/operate/expenses` | Status/category/account filters for history; date range for summary | Paid expense review/confirmation, detail, reviewed void |
| `/operate/customers` | Stable text search, active/archived/all filter, paginated contacts | Create/edit/archive and customer receivable history |
| `/operate/receivables` | Current balances and all/open/overdue/paid/voided filter | Charge, payment, payment reversal, reviewed void |
| `/operate/reports` | Inclusive local date range; exact period flows and current positions | Change/apply a period or retry the read |
| `/settings`, `/billing`, `/billing/success` | Account and configured billing state | Account remains the active primary destination |

The expense date range updates its summary; its history filters retain their existing independent
scope. Reports distinguish period flows from present-day inventory and receivable positions. No
sales total, expense total, or cash movement is described as profit.

The shared structure follows these compact wireframes. Brackets indicate existing controls, not new
product actions; result panels can be loading, unavailable, empty, or populated.

```text
Compact                              Wide
Pisto                   Account      Primary navigation | Context / page title      [Action]
Context / page title                                    | Search / period / filters
[Primary action]                                        | Result state / records / exact totals
Search / period / filters                               | [Load more / retry when applicable]
Result state / records
[Load more / retry]
Operate             Account
```

Control groups wrap at intermediate widths. Wide navigation scrolls independently on short screens.
Result refresh does not replace the page header or its query controls.

## Common interaction contract

| Situation | Required behavior |
| --- | --- |
| A search or filter starts a request | Keep the field, entered text, selection, and page context mounted; replace only the results with loading feedback |
| A query fails or pauses offline | Keep filters and dates available; distinguish unavailable results from an empty successful result; offer retry where meaningful |
| Permission is denied | A fresh 401/403 response overrides cached data and loading/offline companions; hide capability controls and protected results while the existing session recovery handles authentication |
| A successful query returns no records | Say which filter/search has no matches; do not manufacture records or financial zeros from a failure |
| A financial mutation succeeds | Invalidate the owning record/list and all operating report periods for that business; retain other businesses' caches |
| A confirmation is pending | Keep the action name visible and accessible, show progress, and prevent repeated activation |
| A confirmation has an unknown outcome | Preserve the original reviewed payload and idempotency key; offer only the existing exact retry/recovery path |
| A business read refreshes | Preserve an expense period chosen for the same business; initialize it again only when the business/time-zone context changes |
| A user opens billing | Keep Account active in both compact and wide navigation |
| Space or text size changes | Wrap page heading actions and control text; keep controls reachable without horizontal page overflow |

`FilterBar` owns the repeated small single-selection filter interaction. It uses the installed
React Native `Pressable`, a text label that names both context and choice, native toggle-button
state, web pressed-button state, and a 48-unit minimum height. It is used by sales, customers,
receivables, catalog status, cash status, and expense filters. It does not own fetching, permission,
or domain data. Result panels reuse the existing `FeatureBoundary` in an inline composition; no
second query or UI library is needed.

## Audit findings addressed

- Customer search previously unmounted on each uncached query key, losing focus during typing.
- Receivable filters and whole cash/expense/report pages disappeared while fetching. A failed
  report left only Retry, preventing the user from choosing a different period.
- The customer/receivable access boundary checked pending before offline and could show an endless
  spinner for a no-data paused query.
- Expense period initialization depended on the full business object, so a refreshed business
  payload could overwrite an edited period.
- Successful sales, cash, expense, stock/catalog, and receivable mutations omitted operating report
  invalidation; cached report facts could appear current after a canonical change.
- Secondary button spinners were white on light surfaces. Composed buttons replaced their full
  action name with a generic loading announcement. Small shared buttons were only 40 units tall.
- Billing routes had no active primary navigation item. Wide navigation had no independent scroll
  container for short viewports. Header title/action columns did not shrink or wrap coherently.
- Several read states treated every cached error as a stale network result, retaining customer or
  financial data after an authoritative access rejection. Shared remote state, business access,
  and legacy sales/catalog/customer/receivable routes now give access rejection priority. This
  changes display state only; server authorization and business selection remain authoritative.

## Evidence and outstanding checks

The audit inspected the committed wide/compact Operate and sales-history screenshots and the wide
receivables screenshot in `docs/screenshots`. These establish the existing ink/lime/cream palette
and hierarchy; they do not prove the changes in this document have been rendered.

Regression tests cover rendered customer search/filter availability during pending/error/offline,
receivable filter recovery, report date persistence while results are unavailable, retained busy
button names, offline boundary ordering, and real TanStack cache invalidation across report periods
without invalidating another business. The rendering tests use React Native Web's server renderer;
they do not simulate browser focus, native keyboards, or assistive technology.

An additional real QueryClient regression first caches an authorized customer result, rejects its
refresh with 401/403, and verifies that the UI chooses denied despite retained cache data or a
pending companion query. Separate network/502/503/504 cases retain the labelled stale result.

Before release, record real browser evidence at compact, intermediate, and wide widths, including
slow-request search typing, failed-period recovery, empty search, denied access, visible keyboard
focus, long labels, dark appearance, short desktop height, and billing navigation. Validate iOS and
Android safe areas, keyboard behavior, VoiceOver/TalkBack names/state, and navigation separately.
Local typechecks, tests, and web export are necessary but do not prove deployment or native release.

## Research and reuse evidence

No production dependency is added. Existing React Native controls, React Native Web, React Query,
the localization catalog, and Pisto tokens cover the exact slice. A new component library or form
framework would add migration and native compatibility costs without addressing these defects.
Component regression tests use the already installed `react-dom/server`; its matching
`@types/react-dom` development dependency supplies the test compiler types. Vitest uses Vite's Oxc
automatic JSX transform because Expo's source configuration leaves JSX for Metro.

Current primary sources reviewed on 2026-09-10:

- [React Native accessibility](https://reactnative.dev/docs/0.86/accessibility): labels, roles,
  checked/busy/disabled state, and platform differences.
- [React Native Pressable](https://reactnative.dev/docs/0.86/pressable): the existing cross-platform
  interaction primitive and touch behavior.
- [TanStack Query paused queries](https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries):
  pending status is distinct from active fetching, so offline checks must precede a pending spinner.
- [Vite Oxc transform](https://vite.dev/config/shared-options#oxc): the test transform explicitly
  compiles JSX while production continues to use Expo/Metro.

Recheck platform semantics when upgrading Expo/React Native/React Native Web, changing the shared
controls, or making an accessibility conformance claim. Browser/device validation remains required.
