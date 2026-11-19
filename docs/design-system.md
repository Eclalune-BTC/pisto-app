# Pisto UI contract

## Direction

Pisto looks like a modern fintech operations product that a business owner can trust: clean, dense,
calm and precise. The reference is how real finance products are laid out (Mercury's app, Ramp,
Brex, Qonto), as inspiration rather than a copy: defined edges, one grid, plain type and real
product pictures instead of decoration. The layout carries the quality; colour only identifies.

- Pisto's two colours on plain greys. Forest green (`--color-primary` `#1b3d2c`) is the colour of
  primary actions, focus, links, chart lines and the mark's tile; lime (`highlight*`, `chart-fill`,
  `brand-foreground`) is its accent: the mark, chart areas, transcript fragments, the totals of a
  new sale or purchase and the phone money card. Every neutral is a plain grey with no green cast:
  white page and cards, a light grey sidebar, grey hairlines. Green text means money came in
  (`positive*`), amber a warning, red an error or a destructive action.
- No blue anywhere in application-owned UI (test-enforced: hue 175–280° in
  `src/components/ui/no-blue.test.ts`). AA contrast pairs are enforced by `theme-contract.test.ts`.
- Light first: an absent appearance preference renders the light theme; dark and system stay
  available from the user menu. Dark is a neutral near-black page with slightly lighter cards;
  lime becomes the primary action and the chart line. It never uses a tinted dark or a pastel
  button.
- Square, defined corners (4 px marks and chips, 6 px menu rows and segments, 8 px buttons and
  fields, 10 px cards, tables and dialogs, 12 px product frames and sheets). Only avatars are
  round; there are no pill buttons. Density is compact with little padding, while still composing
  the installed React Native Reusables (RNR) components.
- Structure comes from type and hairlines: a section opens with a rule and its heading, and grids
  share `border-t`/`border-l` lines. A card is for a record surface the app really draws.
- The expected record state (posted, active, open) is plain muted text; only exceptions carry a chip.
- No gradients, glows, decorative shadows, eyebrow labels above titles, accent left-border lines,
  ornamental dividers, oversized headings or marketing copy inside the product. Subtle translucent
  surfaces ("glass") are allowed only for the top bar and overlays on the web.
- Real navigation and feedback: breadcrumbs, a user menu, toasts, dialogs, tables and skeletons.

The working method, the rubric used to judge a screen and the lessons learned live in the
`pisto-ui` skill (`.claude/skills/pisto-ui/SKILL.md`); the `ui-critic` agent reviews rendered
screens against it. A passing test suite or a screenshot is not owner aesthetic approval.

## Installation and source ownership

`apps/app/components.json` configures aliases, CSS and the neutral base colour. RNR supplies source
components from the Uniwind registry (reviewed revision `385834c2196f8a303cbc9057d1ac768f3bde0a3b`);
the MIT notice is kept in `apps/app/licenses/react-native-reusables.txt`. The CLI stalled on this
Windows workspace, so sources were added through the documented manual path with exact
`@rn-primitives/*` 1.5.x pins. Future additions can use:

```sh
bunx @react-native-reusables/cli@0.7.1 add COMPONENT --cwd apps/app --styling-library uniwind
```

Installed source is app-owned: review aliases, translations, density, focus and domain adaptations
before overwriting it. The registry has no Sidebar, Sheet, Breadcrumb, Toast or DataTable entry;
those are local compositions of the installed primitives (see below), not a second UI kit.

## Reuse boundaries

| Job | Implementation |
| --- | --- |
| App shell | `components/app-shell.tsx`: light grey sidebar (business menu, grouped modules, settings; the current page is a white card with a forest-green icon, resolved from the declared route parents and never from the path) on wide screens, navigation sheet on compact ones, translucent top bar with breadcrumbs, the record actions and the account menu behind the avatar at its end |
| Home | `features/operate/operate-home-screen.tsx`: full-width bands on one grid: the "Registrar" bar, the balance with its trend beside the accounts that hold it (`money-figure-rows`: one cell per account kind, sharing the card's height), what is owed and what is due side by side, then today's movements. Every card has a 16 px inset and a `font-heading text-title` title, and a figure appears in one card only. Phones stack the same blocks, money first |
| Accounts | `features/cash/cash-account-list.tsx`: one tile per account with its balance, instead of a table of a handful of rows |
| Breadcrumbs and current page | `lib/route-trail.ts` over the declared `features/operate/route-parents.ts`: `buildRouteTrail` for the breadcrumb, `components/shell/current-destination.ts` for the sidebar; record names through `useRouteLabel`, and a page under a record gives it the same name the record's own page does |
| Page structure | `Page` (`form` narrows inside the content grid, so a form's title starts where its list's did; `reading` is a centred column), `layout/page-header`, `layout/section` (ruled: a hairline opens it and the title, its one line and its actions share the row), `layout/stat-group`, `layout/description-list`, `layout/skeletons` |
| Record pages | `layout/detail-columns`: from 1360 px the figures and tables of a sale, purchase, expense, product, customer, supplier, account or receivable fill the main column and its facts sit in a 320 px side column, each list under a `Section` title (`DescriptionList layout="aside"`); narrower screens stack them, main first. A `StatGroup` spans its column even with one figure. Undoing a record is never the page's button: it waits in `HeaderActions` `overflow` |
| Actions and links | RNR `Button` (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `sm`, `default`, `lg`, `icon`, `icon-sm`); Expo Router `Link` owns destinations |
| Records | `ui/data-table` (TanStack row model): semantic `<table>` on wide web, dense list rows elsewhere; rows open records through a real link; `ui/row-actions` for per-row menus |
| Status and callouts | `ui/badge` and `ui/alert` variants `positive`, `warning`, `destructive` |
| Confirmations | `ui/confirm-dialog` (RNR AlertDialog) for consequential commands; it stays open while pending |
| Short tasks | `ui/dialog`, `ui/sheet` |
| Menus | RNR `DropdownMenu`, `Avatar`, `Tooltip` |
| Forms | `Field`, `SelectField`, `DateField`, `TimeField`, the picker field, RNR `Checkbox`, `Switch`, `RadioGroup`; every field label is 14/20 with a 6 px gap over a 36 px control, so the controls of one row share a line. Entity forms group fields with `layout/form-section`; a sale and a purchase put the fields on the page beside one panel with the total on lime, the payment and the save |
| Filters | `ui/filter-bar` (segmented ToggleGroup, one row at every width: on the web it scrolls sideways instead of wrapping), selects and search inputs in a toolbar row |
| Toasts | `lib/notify.ts` over `sonner` (web) and `sonner-native` (native); only `success`, `warning` and `error` (Sonner's info styling is blue) |
| Loading, empty, failed | `ContentSkeleton`, `EmptyState` (after a successful read only), `StatePanel`, `StaleNotice` |

The source boundary tests reject raw `Pressable`, `TextInput`, `Switch` and `ActivityIndicator`
in feature code; use the shared components. Cards and badges contain `Text`, never bare strings.

## Necessary upstream adaptations

- Button keeps `label`, `loading` and role support; loading never enables an action or drops its
  accessible name. Pointer screens get compact sizes; native keeps 44 pt touch targets through the
  `native:` variant.
- Overlays use local `pisto-enter-*` keyframe utilities on the web (the registry's `animate-in`
  classes need a plugin that is not installed) and honour reduced motion. Native overlays animate
  through Reanimated.
- Menus and selects are translucent with a backdrop blur on the web only; React Native has no
  backdrop filter, so native uses the solid token surface by design.
- `withUniwind` is applied to the Icon mapping only.

## Palette, typography and layout

`src/global.css` owns every token. Use the semantic colours (`background`, `foreground`, `card`,
`popover`, `muted`, `accent`, `primary`, `secondary`, `border`, `input`, `ring`, `sidebar-*`,
`destructive*`, `warning*`, `positive*`, `highlight*`, `brand*`, `chart-1…5`); never literal
colours. `input` is the field outline (≥3:1 against every surface). Warning is amber, destructive
is red. Chart colours avoid blue and are for marks, not text.

| Role | Light | Dark |
| --- | --- | --- |
| Page and card | `#FFFFFF` | `#0F0F0E` page, `#171716` card |
| Sidebar | `#F7F7F5` | `#0F0F0E` |
| Text | `#131312` | `#F3F3F1` |
| Secondary text | `#62625E` | `#A3A39E` |
| Primary action | `#1B3D2C` with white text | `#D4F26A` with `#10200F` text |
| Lime accent | `#D9F86C` | `#C6EA52` |
| Border | `#E4E4E1` | `#2A2A28` |
| Money in | `#1D6A43` | `#6FD49B` |

Hanken Grotesk is the one typeface: 400 body (`font-sans`), 500 controls and labels (`font-ui`),
600 headings, money figures, card titles and the wordmark (`font-heading`). Its figures share one
width, so amounts and dates align; keep `tabular-nums` on them for platform fonts.

Text is sized with a role, never a pixel value (`lib/cn.test.ts` rejects `text-[Npx]`). Beyond
Tailwind's `xs` 12, `sm` 14, `base` 16, `lg` 18 and `xl` 20, the theme declares:

| Role | Size / line | Use |
| --- | --- | --- |
| `text-micro` | 11 / 16 | initials, axis labels, transcript markers |
| `text-dense` | 14 / 20 | tables, list rows, descriptions |
| `text-title` | 15 / 22 | card and section titles |
| `text-title-lg` | 20 / 28 | item headings |
| `text-heading` | 24 / 32 | page titles |
| `text-figure`, `-lg`, `-xl` | 24 / 32, 28 / 36, 44 / 50 | money figures |
| `text-headline` | 36 / 42 | public section headings |
| `text-display-sm`, `text-display`, `text-display-lg` | 34 / 38, 46 / 50, 60 / 64 | public hero and closing |
| `text-display-xl`, `text-display-xxl` | 72 / 76, 86 / 80 | large public headings |

Each role carries its line height and tracking. `lib/cn.ts` declares the names to tailwind-merge,
which would otherwise read `text-dense` as a colour and drop the colour beside it; a new role is
added in both places. `Heading` owns the heading sizes (`page`, `section`, `item`, `marketing`,
`display`).

Radii are `--radius-xs`/`-sm` 4 px, `-md` 6 px, `-lg` 8 px, `-xl` 10 px and `-2xl` 12 px; only
avatars are `rounded-full`. Workspace pages share one 1120 px column with 16/24/32 px gutters by
breakpoint; controls are 32–36 px high on pointer screens and 44 pt on touch.

The shell's top bar overlays the content (`Page` reserves its height) so pages scroll beneath its
translucent surface on the web. Each route has one H1 (`PageHeader`); regions use H2 (`Section`).
The breadcrumb replaces back buttons and eyebrows; compact screens show the parent as a back link.

## Domain behavior that design must preserve

Expense history filters affect history; its dates affect the independent period summary. Cash
account filters do not filter movement history. Previous-month sales totals and current receivable
positions must not masquerade as totals of a partially loaded table. Switching UI views cannot
submit or cancel a financial operation.

The server owns permissions, money, ordering, filters and cursors. Keep exact formatters, stable
record IDs, load-more states and every review, correction and payment path. No client sorting or
page counts over a cursor result. An empty state requires a successful read. Denial removes cached
private data and unauthorized navigation. Pending, stale, offline, error and uncertain-confirmation
states remain visible; an uncertain outcome is never reported as a success toast.

## Product assets and branding

`assets/brand/mark.json` owns the mark's geometry: a ring standing on one leg, which reads as a
"p" and as a coin. It is lime on a forest-green tile in both themes, beside the lowercase
wordmark; the icon and favicon are the same tile. `brand:generate` renders icon, favicon and
splash assets. Assets follow the no-blue rule.

The public page pairs Hanken with an original market photograph. The image brief is a Salvadoran
shopkeeper handing over a kraft bag of ground coffee beside an olive scale, in warm daylight.
The opening uses the existing forest and lime brand tokens. The adjacent ledger shows the same
sale as a sentence or a reviewed draft. Its three figures and proportional bar share the
example fixture. Activating “Ver el desglose” reveals the quoted words behind cash and credit.
The headline, photograph and payment split each animate once. Reduced motion displays their
final states immediately.

The film in “Cómo funciona” shows a coffee sale entered and confirmed through Pisto on a disposable
demo business. The 18-second, 720p H.264 file loads on demand on the web. Its three chapter
controls seek to the product, payment and receipt. Native uses the corresponding bundled frames
and the same descriptions. The editable footage contains only fictional shop records.

Four original market photographs pair the cash drawer, closing book, customer ledger and supplier
delivery with the corresponding module. Visitors can swipe, use the previous and next buttons or
choose a tab with the keyboard. The carousel advances on request. Role disclosures use the same
jobs as Settings. The final sign-up invitation uses the lime brand surface. Auth screens use a
shop photograph on wide layouts and keep the form first on small screens.

On the operating home, the dark forest balance and its lime trend sit beside today's movements
when the measured content width allows. A single composer keeps its draft across resizes. The
shell toolbar and page share the same content width and gutters. Summary cells allow long
currency values to use more space.

## Validation and upgrade costs

Run `bun run check`. Browser review covers 390/768/1280/1440 px, both themes, long Spanish labels,
populated/empty/error/denied states, keyboard focus, menus, dialogs and the navigation sheet, then
the `ui-critic` agent scores the screens. Native exports are not device or screen-reader acceptance.

Vitest renders web compositions; `apps/app/test-support` stubs Expo Router links, SVG drawing and
Reanimated timing for node. Keep semantic assertions when updating tests for new markup.

## Primary sources

- [RNR repository](https://github.com/founded-labs/react-native-reusables),
  [CLI](https://reactnativereusables.com/docs/cli),
  [community resources](https://github.com/founded-labs/react-native-reusables/blob/main/COMMUNITY_RESOURCES.md).
- [Uniwind](https://docs.uniwind.dev/), [Uniwind class compatibility](https://docs.uniwind.dev/class-names),
  [Expo platform modules](https://docs.expo.dev/router/advanced/platform-specific-modules/).
- [Sonner](https://sonner.emilkowal.ski/), [Sonner Native](https://github.com/gunnartorfis/sonner-native).
- [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk),
  [shadcn theming](https://ui.shadcn.com/docs/theming),
  [shadcn sidebar blocks](https://ui.shadcn.com/blocks/sidebar).
- References read on 2026-11-17, as inspiration: [Mercury's product demo](https://demo.mercury.com/dashboard),
  [Mercury](https://mercury.com/), [Ramp](https://ramp.com/), [Brex](https://www.brex.com/),
  [Qonto](https://qonto.com/en), [Tailark blocks](https://github.com/tailark/blocks),
  [shadcnblocks Feature 197](https://www.shadcnblocks.com/block/feature197). The blocks are DOM
  components; their proportions were rebuilt with the installed RNR primitives, none was installed.
- [W3C tables](https://www.w3.org/WAI/tutorials/tables/),
  [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
  [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Reviewed 2026-11-17. Recheck when a component, the styling engine, the Expo SDK or an interaction
contract changes.
