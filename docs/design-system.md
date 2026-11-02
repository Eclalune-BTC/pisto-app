# Pisto UI contract

## Owner requirements

Pisto looks like a modern fintech operations product that a business owner can trust: clean, dense,
calm and precise. The owner's direction of 2026-11-01 brings the product back to the Phase 2
prototypes and replaces the graphite-only palette of 2026-10-04:

- One brand colour: a deep forest green (`--color-primary` `#1b3d2c` light, `#a7d8b9` dark) for
  primary actions, focus, selection, links and dark brand panels. Neutrals are tinted toward it;
  amber and red remain reserved for warnings, errors and destructive actions. The prototypes' lime
  (`highlight`, `highlight-strong`, `chart-fill`) appears only where they use it: the phone
  money hero card, chart fills, dictation accents and transcript highlights. `brand` and
  `brand-foreground` keep the logo mark the same in both themes. The sidebar is white with a quiet
  neutral active item; the page is warm off-white with white, hairline-bordered cards.
- No blue anywhere in application-owned UI (test-enforced: hue 175–280° in
  `src/components/ui/no-blue.test.ts`). AA contrast pairs are enforced by `theme-contract.test.ts`.
- Light first: an absent appearance preference renders the light theme; dark and system stay
  available from the user menu.
- Crisp geometry (6 px controls, 8 px cards), compact density and little padding, while still
  composing the installed React Native Reusables (RNR) components.
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
| App shell | `components/app-shell.tsx`: sidebar (business menu, grouped modules, user menu) on wide screens, navigation sheet on compact ones, translucent top bar with breadcrumbs |
| Breadcrumbs | `lib/route-trail.ts` over the declared `features/operate/route-parents.ts`; record names through `useRouteLabel` |
| Page structure | `Page`, `layout/page-header`, `layout/section`, `layout/stat-group`, `layout/description-list`, `layout/skeletons` |
| Actions and links | RNR `Button` (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `sm`, `default`, `lg`, `icon`, `icon-sm`); Expo Router `Link` owns destinations |
| Records | `ui/data-table` (TanStack row model): semantic `<table>` on wide web, dense list rows elsewhere; rows open records through a real link; `ui/row-actions` for per-row menus |
| Status and callouts | `ui/badge` and `ui/alert` variants `positive`, `warning`, `destructive` |
| Confirmations | `ui/confirm-dialog` (RNR AlertDialog) for consequential commands; it stays open while pending |
| Short tasks | `ui/dialog`, `ui/sheet` |
| Menus | RNR `DropdownMenu`, `Avatar`, `Popover`, `Tooltip` |
| Forms | `Field`, `SelectField`, `DateField`, RNR `Checkbox`, `Switch`, `RadioGroup` |
| Filters | `ui/filter-bar` (segmented ToggleGroup), selects and search inputs in a toolbar row |
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
- Menus, selects and popovers are translucent with a backdrop blur on the web only; React Native has
  no backdrop filter, so native uses the solid token surface by design.
- The web Accordion uses Radix directly because the RN Primitives web build emitted duplicate IDs.
- `withUniwind` is applied to the Icon mapping only.

## Palette, typography and layout

`src/global.css` owns the semantic palette ("Graphite": ink and warm neutrals). Use the tokens
(`background`, `foreground`, `card`, `popover`, `muted`, `accent`, `primary`, `secondary`, `border`,
`input`, `ring`, `sidebar-*`, `destructive*`, `warning*`, `positive*`, `chart-1…5`); never literal
colours. `input` is the field outline (≥3:1 against every surface). Positive states use ink text
with a check icon rather than a green fill; warning is amber, destructive is red. Chart colours
avoid blue and green and are for marks, not text.

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#FAFAF9` | `#0F0E0D` |
| Text | `#1C1917` | `#F5F5F4` |
| Primary action | `#1C1917` with `#FAFAF9` text | `#F5F5F4` with `#1C1917` text |
| Card | `#FFFFFF` | `#171615` |
| Border | `#E7E5E2` | `#2B2927` |

Inter (400 body, 500 controls, 600 headings) replaces IBM Plex Sans; amounts, quantities and date
columns use tabular figures. Page titles are 20 px, section titles 14 px, body 14 px, tables 13 px.
Radii are 2–4 px (`--radius-*` overrides in `global.css`); avatars are rounded squares. Page gutters
are 16/24/32 px by breakpoint; controls are 32–36 px high on pointer screens and 44 pt on touch.

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

`assets/brand/mark.json` owns the monogram geometry; `brand:generate` renders icon, favicon and
splash assets. Assets follow the no-blue rule. The public page uses the same components and tokens
as the application. Product captures show real empty forms only; never insert fictional records into
the owner's database for a capture. Visual reviews use the disposable `pisto_ui_review` database.

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
- [Inter](https://rsms.me/inter/), [shadcn theming](https://ui.shadcn.com/docs/theming),
  [shadcn sidebar blocks](https://ui.shadcn.com/blocks/sidebar).
- [W3C tables](https://www.w3.org/WAI/tutorials/tables/),
  [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
  [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Reviewed 2026-10-04. Recheck when a component, the styling engine, the Expo SDK or an interaction
contract changes.
