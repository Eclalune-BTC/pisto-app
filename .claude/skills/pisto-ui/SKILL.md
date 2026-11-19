---
name: pisto-ui
description: Build, redesign or review any Pisto app screen (apps/app, Expo Router + React Native Reusables + Uniwind) to a professional fintech SaaS standard. Use before writing or approving UI code, navigation, theming, tables, forms, dialogs or states, and whenever judging whether a screen looks finished. Contains the screen templates, the scoring rubric, the anti-slop list and an append-only lessons log that must grow after every critique round.
---

# Pisto UI craft

Rules and tokens live in `docs/design-system.md` and `docs/frontend-expo-ui.md`; this skill is the
working method. When a lesson below becomes a durable rule, move it into the design-system doc
(and a test when it is mechanically checkable) and leave a one-line pointer here.

## Direction (owner, non-negotiable)

- Modern fintech that conveys trust: clean, dense, calm, well defined. Real finance products
  (Mercury's app, Ramp, Brex, Qonto) are the inspiration, never a copy. Nothing that looks
  generated.
- Layout first. When the owner says a screen looks generated, the answer is its structure (what
  sits beside what, on which grid, at which size), never a new palette. Changing only colours was
  rejected twice.
- Pisto is forest green with a lime accent, light theme first; that pair is the identity and
  stays. What read as generated was the green cast on the greys, pastel mint and lime washes: the
  neutrals are plain greys, the page is white and the sidebar light grey. Green text is only
  "money came in", amber a warning, red an error. No blue (test-enforced hue band 175-280°).
- Dark is a neutral near-black with lime as the primary action and the chart line, never a
  green-tinted dark with a mint button.
- Square, defined corners: 4 px marks, 6 px segments, 8 px buttons and fields, 10 px cards,
  12 px product frames. No pill buttons, no soft blobs, no tinted "glow box" around a card.
- One typeface (Hanken Grotesk): 400 body, 500 controls, 600 headings, money figures and card
  titles. Sizes come from the type roles in `global.css`, never `text-[Npx]`.
- Structure with type and hairlines before boxes: a rule plus a heading opens a section, grids
  share `border-t`/`border-l`.
- Little padding inside the product: compact rows, tight page gutters, information first.
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
| H2 region | `components/layout/section.tsx` | a hairline opens it; `title`, the one-line `description` and `actions` share the row under the rule |
| Exact figures | `components/layout/stat-group.tsx` `StatGroup`/`Stat` | one shared border; `tone` only for overdue/negative/warning |
| Record facts | `components/layout/description-list.tsx` | label/value rows; `numeric` for money/dates; `layout="aside"` in a side column |
| Record page | `components/layout/detail-columns.tsx` `DetailColumns` | figures and tables in the main column, the facts in `aside` under a `Section` title; stacks below 1360 px, main first |
| Loading | `components/layout/skeletons.tsx` `ContentSkeleton` | `list`/`detail`/`form`/`section`; never a page spinner |
| Whole-route state | `components/route-state.tsx` `RouteState` | `kind` loading/offline/denied/notFound/unavailable/error, `variant` skeleton, `onRetry` on error; pass `title`/`description` when the record matters |
| Section states | `FeatureBoundary`, `ui/state-panel`, `ui/empty-state`, `remote-state` (`OfflineState`, `StaleNotice`) | empty only after a successful read |
| Records | `ui/data-table` | `getRowHref` makes the row and its primary cell a real link; `onRowPress` opens in place (dialog); `rowActions` + `ui/row-actions`; `meta.primary`, `meta.align: "end"`, `meta.figure`, `meta.width`, `meta.hideOnCompact` |
| Status | `ui/status-badge` `StatusBadge` | `tone`: `normal` (quiet), `exception` (voided/archived), `attention` (overdue, low stock), `settled` (paid); red never marks a state |
| Header actions | `components/layout/header-actions.tsx` | `primary` stays visible, `secondary` folds into the one overflow menu on phones, `overflow` with `destructive` last and `disabledReason`; `menuTriggerRef` for focus return |
| Callouts | `ui/alert` | `default`, `positive`, `warning`, `destructive`; `action` slot. No `border-l-4` boxes |
| Send a keyed command | `lib/keyed-command` `useKeyedCommand` | the only way to send a command with an idempotency key: an unknown outcome stays `uncertain` through later refusals of that key until CONFLICT/NOT_FOUND proves it never committed |
| Review a command | `components/command-review.tsx` | the page header shows the review title; `note` states the consequence; `disabled` blocks the first send only |
| Confirm consequential command | `ui/confirm-dialog` + `lib/mutation-phase` | `phase` (`idle`/`pending`/`failed`/`uncertain`) locks it while pending or uncertain; retry resends the same key; `returnFocus` from `lib/focus-return` |
| Short forms | `ui/dialog` (wide) / `ui/sheet` | for create/rename of simple entities; money flows keep their routes |
| Filters | `ui/filter-toolbar`, `ui/filter-bar` (segmented, "Todos" first), `ui/select-field` `labelHidden`, `ui/search-field` | one wrapping row under the section title, never in the section header |
| Form end | `components/layout/form-actions.tsx` | cancel (href with replace, or handler) then the primary step, trailing edge |
| Fields | `ui/field` (`description`, `error`), `ui/select-field` (`error`), `ui/moment-fields` (date + time pair), `ui/date-field`, `ui/time-field` | pickers forward `ref` so a rejected form can focus them |
| Feedback | `lib/notify.ts` `notify.success/warning/error` | after definitive results; uncertain outcomes stay inline and blocking |
| Breadcrumb names | `useRouteLabel(route, name)` from `components/shell/shell-context` | call on detail screens once the record loaded |
| Formatting | `lib/money` `formatMinorUnits`, `i18n/format` (`formatLocalizedDateTime`, `formatLocalMoment`, `formatLocalDate`) | one format: spelled month + 24 h; a test forbids feature-local `Intl.DateTimeFormat`; `tabular-nums` on every amount/date column |
| Reviewed change | `components/layout/review-values.tsx` `ChangedValue` | arrow hidden from readers, one "Antes … Ahora …" sentence |

Reference implementation: `features/operate/operate-home-screen.tsx` (home summary).

Screen rules that follow from the owner direction:

- Open a record by clicking its row; no "Ver" button columns. Per-row actions go in `RowActions`,
  destructive last after a separator.
- No back buttons: the breadcrumb navigates. Form "Cancelar" returns to the parent route.
- Forms: `Page width="form"`, fields grouped in titled sections, actions at the end (secondary
  then primary). Review steps show a `DescriptionList` summary and an explicit confirm.
- Money: right-aligned, tabular, default text colour; destructive colour only for an overdue or
  negative value greater than zero, never for zero. Overdue is red on every screen; the warning
  tone is for "due soon" only. A ledger signs money in with a plus and the positive tone.
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

- 2026-10-04 · all screens · Hooks inside object literals crash under the React Compiler; TanStack
  row renderers must opt out with "use no memo" · `component-boundaries.test.ts`.
- 2026-10-04 · shell · Keep the navigator mounted during session restore; never swap it for a
  spinner, and remember only settled URLs without child record ids · `app/(app)/_layout.tsx`,
  `lib/route-trail.ts`.
- 2026-10-04 · all lists · Ledger lists order by when entries happened `(occurred_at, created_at,
  id)`; copy says "por fecha" · `packages/db/src/pagination.ts`.
- 2026-10-04 · cash · System-written text is never shown verbatim; system movements store no reason
  and are labelled from their action · `features/cash/copy.ts` `cashMovementReason`.
- 2026-10-04 · money reviews · A review shows each account's resulting balance and stops an outflow
  a protected account cannot cover · `features/cash/drafts.ts` `balanceAfter`.
- 2026-10-04 · commands · A retry refused by rate limit, pause or session after an unknown outcome
  stays uncertain; editing would mint a second key · `lib/keyed-command`.
- 2026-10-04 · modules · Parallel module work forked confirm dialogs, reviews, route states, search,
  header menus and form footers; reuse the shared block or extend it, never copy it into a feature.
- 2026-10-04 · tooling · On Windows the Expo typed-routes watcher writes files outside `src/app` as
  routes and TypeScript reports TS2590; restart Expo with `--clear` before trusting tsc.
- 2026-11-01 · all screens · A chip on every "Registrada" row and "Ver … →" arrow links read as
  generated; the normal state is muted text and links are plain link-coloured text · `ui/status-badge`.
- 2026-11-01 · auth · A checklist of product promises beside the sign-in form is marketing slop; the
  aside is a solid brand panel with one sentence · `components/auth-screen.tsx`.
- 2026-11-01 · tooling · `CI=1 expo start` does not watch files, and Chrome captures of a fresh dev
  bundle can time out while the page is idle; check `document.body.innerText` before calling a
  screen frozen.
- 2026-11-01 · session restore · Replacing the QueryClient when the restored session resolves left
  every mounted query loading forever after a reload; the client changes only on a direct account
  switch · `providers/query-provider.tsx`.
- 2026-11-02 · new sale · Field labels and ghost actions on a lime `bg-highlight` panel lose contrast
  in dark mode; keep the highlight to the figure block (the total) and the fields on the card
  surface · `features/sales/itemized/itemized-sale-form.tsx`.

- 2026-11-02 · shell · A permanent "En vivo" dot reads as generated; realtime stays silent while
  live or connecting and shows one muted top-bar line only after a real disconnect ·
  `components/shell/realtime-interruption.ts`.
- 2026-11-02 · auth, landing · The forest-green brand panel turns pale mint with the dark palette;
  dark mode uses the card surface and the default transcript tone instead · `auth-screen.tsx`,
  `welcome-screen.tsx`.
- 2026-11-02 · home, movements · Big money figures wrap instead of clipping; a 390 px strip of three
  totals truncated "+$185.50", so totals keep a 140 px basis and drop to two per row.
- 2026-11-02 · tooling · Several worktrees on 127.0.0.1 share one cookie jar in the shared Chrome;
  capture with a headless Chrome profile of your own (CDP) instead of the shared window.
- 2026-11-02 · landing · Product pictures are composed from the app's own pieces (`MoneyFigure`,
  `MoneyTrendChart`, `CashFlowChart`, `TranscriptHighlight`, the Configuración role jobs) fed with
  one example business whose figures add up, are labelled once as an example and are checked by a
  test; never screenshots, stock art or invented statistics · `features/welcome/example-business.ts`.
- 2026-11-02 · landing · Illustrated controls take `buttonVariants` on a plain View inside a
  `pointer-events-none` figure, so the page never announces a button it cannot press; the test
  counts `role="button"` · `features/welcome/fragments.tsx` `ButtonLook`.
- 2026-11-02 · landing · A 248 px card truncated "Vencido desde el …"; balance rows put the amount
  on the name line so the due date keeps the full width · `fragments.tsx` `BalanceLine`.
- 2026-11-02 · landing · A three-column step grid misaligned when one description wrapped to three
  lines; keep step copy under ~70 characters and let the figure panels stretch to one height.
- 2026-11-02 · landing · `web:text-balance` on display headings removes the lone last word
  ("cuaderno.") at every width.
- 2026-11-02 · tooling · Capturing right after files change (e.g. `biome check --write`) can serve
  CSS without newly used breakpoint classes and draw a broken layout; recapture before judging.
  Git Bash rewrites a "/sign-in" argument into a Windows path (`MSYS_NO_PATHCONV=1`), and a full
  capture of a ScrollView page needs the scroll content height plus the header.
- 2026-11-02 · landing · `hidden sm:flex` on a web `Text` makes it a flex box and cancels
  `text-right`; toggle visibility on a wrapper View. A `min-w-0 flex-1` label beside fixed figure
  columns collapsed to nothing in a half-width card at 768 px: give it a minimum width and check
  two-column grids at their narrowest · `features/welcome/module-previews.tsx`.
- 2026-11-02 · landing · A bordered card inside a tinted frame read as a card inside a card, and
  centred cards started at different heights; illustration cards sit directly on the page, top
  aligned · `features/welcome/how-it-works.tsx`.
- 2026-11-02 · landing · The same example card shown in the hero and again in a module section read
  as padding; each example fact appears once (the hero owns the home, module previews show other
  screens) and a month in progress is left out unless its figures follow the day of the month.
- 2026-11-02 · landing · An example row reading "$0.00" (a sale on credit) looked like a bug on a
  sales page, and one warning tone for "vencido" and "vence esta semana" hid a real difference;
  pick example records whose amount reads right on its own, and give each preview the tones of
  the screen it shows · `features/welcome/example-business.ts`, `module-previews.tsx`.
- 2026-11-17 · landing, logo · The owner called the page and the "P in a rounded square" logo
  vibecoded: a thick forest-green frame around a lime card, three small cards per row and Inter.
  What read as designed instead: one centred sentence, the real app frame cropped at the fold,
  steps as tabs with one large figure, module fragments in a hairline grid without cards, and a
  drawn mark (a ring on one leg) on the forest tile instead of a letter ·
  `features/welcome/*`, `components/brand.tsx`.
- 2026-11-17 · tokens · 26 one-off pixel font sizes and 12 one-off trackings had spread through
  the screens; sizes are theme roles now and a test rejects `text-[Npx]`. A custom `text-*` role
  must also be declared to tailwind-merge or `cn` silently drops the colour beside it ·
  `global.css`, `lib/cn.ts`, `lib/cn.test.ts`.
- 2026-11-17 · tokens · Corner sizes had drifted to seven values plus hard-coded pixels in the
  CSS, and one button overrode the shared shape; the scale is 4/6/8/10/12 and CSS reads the
  variables ·
  `global.css`, `components/auth-screen.tsx`.
- 2026-11-17 · palette, dark · The owner called the result "AI greens", the mint primary button
  of the dark theme strange and the pills undefined. Replacing the brand with black ink was the
  wrong answer: they said it removed what made it Pisto and looked worse. What was generated-
  looking was the green cast on the greys and the pastel washes. Kept: forest green and lime on
  plain greys, white page, grey sidebar, lime primary in dark, square corners, 14 px text ·
  `global.css`, `docs/design-system.md`.
- 2026-11-17 · home · A wide card with a right rail of stacked cards read as a generated
  dashboard. Mercury's demo lays the home out in full-width bands on one grid, so the home is the
  "Registrar" bar, the balance beside the accounts that hold it, owed and due side by side, then
  today's movements · `features/operate/operate-home-screen.tsx`, `money-card.tsx`.
- 2026-11-17 · every page · A title, a paragraph, a block, another title and another paragraph
  read as a generated document. A section is ruled now: a hairline opens it and its title, its
  one line and its actions share the row; the expense period total sits beside its categories on
  wide screens instead of above them · `components/layout/section.tsx`, `features/expenses/expenses-screen.tsx`.
- 2026-11-17 · record pages · Three or four label/value rows stretched across a 1056 px page,
  and a lone total tile above them, read as a generated detail page. A sale, purchase, product,
  customer, supplier, account and receivable now put figures and tables in the main column and
  the facts in a 320 px side column, like a receipt · `components/layout/detail-columns.tsx`.
- 2026-11-18 · home · Three 48 px rows in a 380 px column left a hole beside the chart; the
  account kinds are cells that share the card's height, and the landing preview draws the same
  component · `features/operate/money-figure-rows.tsx`.
- 2026-11-18 · compact rows · A detail that wrapped started its line with the "·" separator; every
  detail leads with its separator and the row is pulled left under a clip, so a line never starts
  with one · `components/ui/data-table-records.tsx`.
- 2026-11-18 · forms · Three label boxes (14/20 in `Field`, 13/13 in the web date and time
  inputs, 14/14 with an 8 px gap in the customer and supplier picker) put the controls of one row
  3 to 7 px apart; every field label is 14/20 with a 6 px gap · `global.css`
  `.pisto-picker-field label`, `features/customers/picker-field.tsx`.
- 2026-11-18 · home · A closed `Dialog` still renders an empty element, which took a gap slot and
  left the "Registrar" card 12 px taller below than above; keep dialogs outside spaced columns ·
  `features/assistant/assistant-composer.tsx`.
- 2026-11-18 · landing · Two rejected openings in a row. A centred headline over a dashboard
  read as "demasiado genérica". The answer to that, a full-width forest-green band with quoted
  sentences and lime labels, closing on a lime band, read as "horrible, muy AI slop": coloured
  bands and quote lists are decoration, the testimonial template with other words. What the
  references the owner named do (Mercury, Ramp, Qonto) is keep the page neutral, set one large
  left-aligned statement, and let the product be the only picture and the only colour. The page
  now does that: no bands, the home at desktop and phone size on one grey stage, statements
  instead of title-plus-paragraph. Never answer "generic" by adding colour blocks or invented
  copy · `features/welcome/welcome-screen.tsx`, `product-preview.tsx` `PhonePreview`.
- 2026-11-18 · phone home, dark · On the lime card the trend line used the primary colour, which
  is lime in the dark theme, so the line vanished and "Hoy" was white on lime. The lime surface
  draws with its own ink in both themes · `features/operate/money-trend-chart.tsx`.
- 2026-11-18 · shell · A purchase lives under `/operate/purchases` and opens from "Por pagar", so
  matching the sidebar by path prefix left both purchase routes with no current item; the sidebar
  reads the declared parents, and a test resolves every declared route to exactly one item ·
  `components/shell/current-destination.ts` and its test.
- 2026-11-18 · purchase form · Three closed picker dialogs inside the spaced row took three
  24 px gaps and left the form 72 px short of the page; a closed dialog still renders an element,
  so it never sits inside a `gap` row or column that is measured · `purchase-form.tsx`.
- 2026-11-18 · record pages · An independent review of the captures found four compositions for
  six record pages. One rule now: figures (a `StatGroup` that spans its column) and tables in
  the main column, every fact list titled in the side column, no fact repeated in the header,
  and the action that undoes the record in the overflow menu.
- 2026-11-18 · home · "Vencido" was amber on Home and red on Por pagar and the customer page,
  and "Le deben" repeated the "Por cobrar" figure under it; overdue is red everywhere and a
  figure appears once · `features/operate/*-card.tsx`.
- 2026-11-18 · ledgers · The cash ledgers showed unsigned amounts under "Importe" while
  Movimientos showed "+$2.50" in green under "Monto", and stock movements wore a chip on every
  row; one word ("Monto"), one signed amount, plain type text, and only rows that open something
  answer the pointer · `cash-movement-list.tsx`, `movement-table.tsx`, `global.css`.
- 2026-11-18 · phone filters · Six segments wrapped into two rows inside a grey block; the
  segmented control keeps one row and scrolls sideways on the web · `ui/filter-bar.tsx`.
- 2026-11-18 · copy · The product addressed the owner as "tú" in about half its strings and
  "usted" in the rest. Every string now uses usted, the form the landing, Home, purchases and
  the assistant already had; a catalog test rejects second-person pronouns and the verb forms
  that had slipped in. Lines that describe what Pisto or a role does stay in third person ·
  `i18n/resources.test.ts`.
- 2026-11-18 · review steps · A review kept the form's line ("Los revisará antes de guardar")
  above the summary, and the correction page renamed its sale to the amount in the breadcrumb;
  a review shows only its note, and a child page names the record as the record's page does.
- 2026-11-18 · open · Date and time fields are the browser's native inputs and follow the
  browser's language, not the app's spelled-month format. Replacing them needs a calendar
  component of our own; that is the owner's decision.
- 2026-11-18 · tests · A test that renders the whole shell once per route passed alone and timed
  out under the default worker count; put the rule in a pure function and test that.
- 2026-11-18 · tooling · To see a state the local machine cannot produce (assistant on), replace
  only the body of that one response in the capture browser and say so in the caption; never
  change product code or seed data for a screenshot.
- 2026-11-18 · first run · `Label` sizes its row to the text, so `flex-1` on it does not wrap a
  sentence beside a checkbox; bound it with a `min-w-0 flex-1` View · `app/(app)/business.tsx`.
- 2026-11-17 · purchase form · Fields and a segmented control on a lime panel lost contrast and
  read as a glow box; lime marks only the total, as in the sale form ·
  `features/purchases/purchase-form.tsx`.
- 2026-11-17 · sidebar · A grey chip on a grey rail did not mark the current page; it is a white
  card with a hairline and a forest-green icon, and the business block is the same card ·
  `components/ui/sidebar.tsx`, `components/shell/business-menu.tsx`.
- 2026-11-17 · movements · A period selector inside a cell of the totals strip read as filler;
  it sits beside the page title, as in Reportes, and the strip keeps its three figures ·
  `features/movements/movements-screen.tsx`.
- 2026-11-17 · tooling · When memory is short, render from one `expo export --platform web
  --max-workers 1` (with `APP_VARIANT=development`) served by a small static server with a
  single-page fallback, plus the API; a Metro dev server holds over a gigabyte for as long as it
  runs.
- 2026-11-17 · shell, cash · The account menu sits behind the avatar at the end of the top bar on
  every width, so the sidebar ends at Configuración; a handful of accounts are tiles with their
  balance, not a two-row table · `components/shell/nav-user.tsx`, `features/cash/cash-account-list.tsx`.
- 2026-11-17 · landing hero · "Súper simple" means one sentence, one supporting line and one
  button, with the product right below; the note, the second button and the tinted stage went ·
  `features/welcome/welcome-screen.tsx`.
- 2026-11-17 · tooling · Dark is captured by setting `localStorage["pisto.appearance"]` before
  load; swapping the `dark` class by hand leaves icons and charts on the light values they read
  through JavaScript and draws a theme that does not exist.
- 2026-11-17 · tooling · Playwright's bundled Chromium may not match the installed package;
  `chromium.launch({ channel: "chrome" })` drives the installed Chrome. A ScrollView page is
  captured whole by growing the viewport to the scroll content's height. Signed-in screens are
  reviewed with the seeded demo owner on the disposable `pisto_ui_review` database.
- 2026-11-18 · landing header · At 360 and 320 px the brand, the appearance switch, "Iniciar
  sesión" and "Crear cuenta" did not fit and the primary button was clipped at the edge. Below
  `md` the header keeps the brand and "Crear cuenta" and folds the sections, sign-in and the
  appearance switch into one menu; capture 320 and 360, not only 390 ·
  `features/welcome/header-menu.tsx`.
- 2026-11-18 · landing hero · The picture left out the home's "Registrar" composer, so the first
  screen showed a dashboard and not what the headline promises; it now leads the window. Putting
  the page's long example sentence in its one-line field was wrong: it was cut at every width.
  No ellipsis inside a product picture from 320 to 1440 px; where a pictured phone is narrower
  than a real one, the field takes a row of its own · `features/welcome/product-preview.tsx`.
- 2026-11-18 · landing hero, overlay · The phone over the window cut "$2,035.00", a supplier's
  name and an axis label. An overlay's edge is a column line: the rows under it end before it,
  and what no longer fits beside it steps aside · `product-preview.tsx` `ProductPreview`.
- 2026-11-18 · landing hero, crops · Adding a block above moved every crop line: at 768 px the
  stage sliced a label. A fixed-height crop is set per breakpoint range and checked at both ends
  of each (767/768, 1023/1024, 1279/1280) with no text crossing the stage edge; below `md` the
  phone frame closes after the composer instead of being cropped · `welcome-screen.tsx`.
- 2026-11-18 · landing modules · Cells of a two-column hairline grid ended 170 px apart and left
  holes. Pair the cells by height (Movimientos with Reportes, Por cobrar with Por pagar) and
  check the first width of a breakpoint, where a legend wraps. Levelling a cell with rows another
  picture already shows was rejected in review as padding ·
  `features/welcome/module-previews.tsx`.
- 2026-11-18 · landing, 320 px · A hand-built table needs the same fixed column width in its
  header and its rows, or a name wider than its share drifts off its marks; a `max-w-[N]` child
  of a wrapping row needs `shrink`; a strip of fixed bars needs `flex-1 max-w-[N]` ·
  `roles-section.tsx`, `how-it-works.tsx`.
- 2026-11-18 · tabs · The tab primitive focuses a trigger from script, so Chrome matches
  `:focus-visible` after a pointer press and the global ring boxed the whole step. A large
  trigger replaces the ring with its own focus mark (the underlined title) · `how-it-works.tsx`.
- 2026-11-18 · tooling · `react-native-web` 0.21.3+ with Uniwind 1.12.1 exports a bundle that
  builds, typechecks and passes unit tests but renders nothing. After any dependency change,
  load the exported page before calling the change verified · `docs/versioning-upgrades.md`.
- 2026-11-18 · landing · The owner found the side-by-side framed dashboard too generic. The
  public page pairs a photographed sale with an interactive cash and credit breakdown. Use
  one-shot motion to connect quoted words to money, with an immediate reduced-motion state.
