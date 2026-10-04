---
name: pisto-ui
description: Build, redesign or review any Pisto app screen (apps/app, Expo Router + React Native Reusables + Uniwind) to a professional fintech SaaS standard. Use before writing or approving UI code, navigation, theming, tables, forms, dialogs or states, and whenever judging whether a screen looks finished. Contains the screen templates, the scoring rubric, the anti-slop list and an append-only lessons log that must grow after every critique round.
---

# Pisto UI craft

Rules and tokens live in `docs/design-system.md` and `docs/frontend-expo-ui.md`; this skill is the
working method. When a lesson below becomes a durable rule, move it into the design-system doc
(and a test when it is mechanically checkable) and leave a one-line pointer here.

## Direction (owner, non-negotiable)

- Modern fintech/AI SaaS that conveys trust. Clean, dense, calm. Nothing that looks generated.
- No blue (test-enforced hue band 175-280°) and no green brand color. Color is for state and data.
- Nearly square: small radii from the radius tokens; never pill buttons or soft blobs.
- Little padding: compact rows, tight page gutters, information first.
- No gradients, glows, decorative shadows, eyebrow labels, accent left-border lines, ornamental
  dividers, oversized headings or marketing copy inside the product.
- Subtle glass only where it carries meaning: sticky top bar, overlays, popovers (web blur;
  native uses the solid surface by design).

## Workflow for any screen

1. Name the route's job: `list`, `detail`, `create/edit`, `review/confirm`, `report`, `settings`.
2. Compose it from the shell and templates below. Reuse `src/components/ui` and shared layout
   components; never hand-roll a primitive that exists (see `component-boundaries.test.ts`).
3. Keep every domain contract: server-owned money/permissions/filters/cursors, review and
   confirmation steps, truthful loading/empty/error/denied/offline states, `skipToken` for missing
   context, no invented metrics.
4. Render it in the isolated review environment (see "Review environment") in light and dark at
   390, 768, 1280 and 1440 px, including loading, empty, populated, error and long-text states.
5. Spawn the `ui-critic` agent on those routes. Fix every P0/P1 before moving on.
6. Append what the round taught to the lessons log: concrete, checkable, with the screen.

## Building blocks (apps/app/src)

| Need | Use | Notes |
| --- | --- | --- |
| Route body | `components/page.tsx` `Page` | `width="content" \| "form" \| "reading"`; reserves the top-bar inset |
| H1 + actions | `components/layout/page-header.tsx` | `title`, one-line `description`, `actions` (primary last), `adornment` (badge). Never an eyebrow |
| H2 region | `components/layout/section.tsx` | `title`, optional `description`, `actions`; no borders |
| Exact figures | `components/layout/stat-group.tsx` `StatGroup`/`Stat` | one shared border; `tone` only for overdue/negative/warning |
| Record facts | `components/layout/description-list.tsx` | label/value rows; `numeric` for money/dates |
| Loading | `components/layout/skeletons.tsx` `ContentSkeleton` | `list`/`detail`/`form`/`section`; never a page spinner |
| Remote states | `FeatureBoundary`, `ui/state-panel`, `ui/empty-state`, `remote-state` (`OfflineState`, `StaleNotice`) | empty only after a successful read |
| Records | `ui/data-table` | `getRowHref` makes the row and its primary cell a real link; `onRowPress` opens in place (dialog); `rowActions` + `ui/row-actions`; `meta.primary`, `meta.align: "end"`, `meta.figure`, `meta.width`, `meta.hideOnCompact` |
| Status | `ui/badge` | `secondary`, `outline`, `positive`, `warning`, `destructive`; status is never plain text |
| Callouts | `ui/alert` | `default`, `positive`, `warning`, `destructive`; `action` slot. No `border-l-4` boxes |
| Confirm consequential command | `ui/confirm-dialog` + `lib/mutation-phase` | `phase` (`idle`/`pending`/`failed`/`uncertain`) locks it while pending or uncertain; retry resends the same key; `returnFocus` from `lib/focus-return` |
| Short forms | `ui/dialog` (wide) / `ui/sheet` | for create/rename of simple entities; money flows keep their routes |
| Filters | `ui/filter-bar` (segmented radios), `ui/select-field`, `ui/input` with search icon | toolbar row above the table |
| Fields | `ui/field` (`description`, `error`), `ui/select-field` (`error`), `ui/date-field`, `ui/time-field` | pickers forward `ref` so a rejected form can focus them |
| Feedback | `lib/notify.ts` `notify.success/warning/error` | after definitive results; uncertain outcomes stay inline and blocking |
| Breadcrumb names | `useRouteLabel(route, name)` from `components/shell/shell-context` | call on detail screens once the record loaded |
| Formatting | `lib/money` `formatMinorUnits`, `i18n/format` (`formatLocalDate`, `formatLocalizedDateTime`) | `tabular-nums` on every amount/date column |

Reference implementation: `features/operate/operate-home-screen.tsx` (home summary).

Screen rules that follow from the owner direction:

- Open a record by clicking its row; no "Ver" button columns. Per-row actions go in `RowActions`,
  destructive last after a separator.
- No back buttons: the breadcrumb navigates. Form "Cancelar" returns to the parent route.
- Forms: `Page width="form"`, fields grouped in titled sections, actions at the end (secondary
  then primary). Review steps show a `DescriptionList` summary and an explicit confirm.
- Money: right-aligned, tabular, default text colour; destructive colour only for an overdue or
  negative value greater than zero, never for zero.
- List filters live in the URL (`useLocalSearchParams` + `router.setParams`) so returning from a
  record restores them.

## Templates by job

| Job | Composition |
| --- | --- |
| Shell | Sidebar (business switcher header, grouped module nav, NavUser footer) + sticky top bar (sidebar trigger, breadcrumb, page-level actions) + scrollable content with one max width |
| `list` | PageHeader (title, one-line description, primary action) → toolbar (search/filters/segmented status, right-aligned secondary actions) → DataTable on wide screens / divided list rows on compact → load-more footer |
| `detail` | PageHeader with status badge and actions (primary + overflow dropdown) → summary strip of real figures → description list sections → related records table |
| `create/edit` | Short tasks in a Dialog (wide) / bottom sheet route (compact); long tasks as a page with sectioned form and sticky action bar. Field errors inline, submit shows pending state |
| `review/confirm` | Read-only summary of exactly what will be committed, explicit confirm button, destructive actions through AlertDialog, uncertain results reconciled before retry |
| `report` | Range control in the toolbar, stat tiles with exact figures and labels, tables for breakdowns; never a chart without its numbers |
| `settings` | Two-column on wide (section label/description left, controls right), one column compact |

Feedback: completed mutations raise a toast with the result and a link to the record; failures
keep the form open with the server message. Loading uses skeletons shaped like the final layout,
never a centered spinner for a page. Empty states: icon, one sentence, the primary action.

## Rubric (score each 0-2; ship at ≥ 18/20 with no 0)

1. Hierarchy: one primary action per view, consistent title/description scale, nothing shouting.
2. Orientation: breadcrumb and current nav item are correct; back affordance on compact.
3. Density and alignment: one content width, spacing on the 4 px grid, aligned columns, money
   right-aligned with tabular numbers.
4. Components: design-system primitives only; dialogs/sheets for short tasks; AlertDialog for
   destructive confirmations; dropdown menus for overflow actions.
5. States: skeleton, empty (with action), error (with retry), denied, offline, pending, stale.
6. Feedback: toast or inline confirmation for every mutation; no silent success, no fake success.
7. Color and theme: tokens only, AA contrast in both themes, no blue/green branding, state colors
   only for state.
8. Typography: font roles and weights from the theme, tabular figures for amounts, no oversized H1.
9. Responsiveness: 320-1440 px without overflow; compact list rows; sheet navigation.
10. Copy: short Spanish, consistent verbs, no developer jargon (ISO, IANA, UUID) in the UI.

## Anti-slop list (reject on sight)

- Labels above titles ("Mi negocio", "Primer paso") acting as fake breadcrumbs.
- Accent left-border blocks such as the old "Espacio de trabajo / Tienda Luna" sidebar header.
- Every section wrapped in a bordered card; cards inside cards; directory pages of cards.
- Text-only "Volver" buttons; pages without breadcrumb or current-nav state.
- Page-level spinners; navigation that changes shape while the session loads.
- Full-page forms for two-field tasks; filters as a row of large outlined buttons under a label.
- Free-text technical inputs (currency code, time zone) where a picker belongs.
- User identity as plain text with a separate sign-out button instead of a NavUser menu.
- Gradients, glows, emoji, decorative illustrations, generic stock "AI" sparkles.

## Review environment

Never insert test records into the owner's database. Use the disposable `pisto_ui_review`
database: API on port 3025 and Expo web on 8095 (see the lead's session notes or restart them with
`DATABASE_URL=.../pisto_ui_review`, `API_PORT=3025`, `CORS_ORIGINS=http://localhost:8095`,
`EXPO_PUBLIC_API_URL=http://localhost:3025`). Review account: `ui-review@pisto.test`.

## Lessons log

Append one line per lesson: `YYYY-MM-DD · screen · lesson · where it is now enforced`.

- 2026-10-04 · sales review · Review steps for irreversible commands focus "Editar", never the
  commit button, so a repeated Enter cannot post unread · sales review screens.
- 2026-10-04 · sales correction · Edit and replace flows seed from the source record only when
  currency and time zone still match; defaults are seeded once, never from an effect watching
  empty values · sales correction.
- 2026-10-04 · static notices · A static notice is a note, not an alert: pass `role="note"` so it
  is not announced assertively · `ui/alert` callers.
- 2026-10-04 · chips · Check every "stronger chip" claim in dark mode too: fill vs surface ≥1.5:1.
- 2026-10-04 · cash ledgers · Table containers scroll and never clip money; dates and amounts do not
  wrap · `.pisto-data-table` CSS.
- 2026-10-04 · cash ledgers · Copy never claims an ordering the visible dates contradict (lists are
  ordered by recording time) · ledger section descriptions.
- 2026-10-04 · dialogs · Dialogs opened from rows or menus return focus to their opener; `hitSlop`
  does nothing on the web · `lib/focus-return`, `ui/confirm-dialog`.
- 2026-10-04 · uncertain commands · An uncertain outcome keeps the dialog locked with only "Reintentar
  la misma confirmación", even after freshness is lost, because the server re-authorizes the same
  key · `ui/confirm-dialog`.
- 2026-10-04 · compact rows · Compact rows keep the field that tells records apart; selects own
  their errors · `ui/data-table` `meta.figure`, `ui/select-field` `error`.

- 2026-10-04 · sidebar header · A bordered "workspace" label block reads as AI slop; the business
  belongs in a switcher button with initials, name and currency · pending business switcher.
- 2026-10-04 · all pages · Eyebrow + 32 px H1 + explanatory paragraph made every page look like a
  landing page; titles are 20-24 px with one muted line at most · pending PageHeader.
- 2026-10-04 · cash, sales · Centered spinners and nav items appearing after load felt broken;
  shells render immediately and content uses skeletons · pending skeleton templates.
