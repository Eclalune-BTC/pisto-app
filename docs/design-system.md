# Pisto UI contract

## Owner requirements

Use **React Native Reusables, Uniwind registry** as the shared component base. Blue is prohibited in
application-owned UI: public pages, authenticated screens, links, focus, native navigation colors,
icons and product captures. The prior cobalt proposal was rejected and is not a reference to restore.
Do not replace it with another invented marketing palette. Both themes use the same neutral tokens.

This document distinguishes the owner's requirements from library contracts and local implementation
choices. A component installation, passing test or screenshot does not establish aesthetic approval.
Spacing, font and radius choices are product defaults, not universal accessibility rules.

## Installation and source ownership

`apps/app/components.json` configures project aliases, CSS and the neutral base color. RNR supplies
source components, not a single runtime package. Source was installed from the official Uniwind
registry at revision `385834c2196f8a303cbc9057d1ac768f3bde0a3b`, reviewed on 2026-09-27. The source
license is retained in `apps/app/licenses/react-native-reusables.txt`.

The CLI resolved the registry but stalled at dependency installation in this Windows workspace.
Installation was completed using the documented manual-source path and exact dependency versions,
not by calling the unfinished CLI run successful. Future additions can use:

```sh
bunx @react-native-reusables/cli@0.7.1 add COMPONENT --cwd apps/app --styling-library uniwind
```

Review changes before using `--overwrite`: installed source contains necessary domain/accessibility
adaptations. Do not install the whole registry speculatively or regenerate the Expo application.

Installed component families include Button, Text, Input, Label, Textarea, Card, Badge, Alert,
Separator, Checkbox, RadioGroup, Switch, Dialog, Tooltip, Toggle/ToggleGroup, Select, Tabs and
Accordion, with the upstream Icon and native-animation helpers. They live in `src/components/ui`.
The primitives they require are explicit pinned dependencies. Expo, Uniwind and the existing
Reanimated stack remain; no Nativewind migration or second theme system is introduced.

## Reuse boundaries

| Job | Implementation |
| --- | --- |
| Actions and links | RNR `Button`/`Text`; Expo Router owns real destinations |
| Text and headings | RNR `Text` and its text-style context; `Heading` supplies Pisto's existing heading roles/sizes |
| Form fields | RNR `Input`, `Textarea`, `Label`; `Field` composes labels, errors and optional trailing controls |
| Entity/category selection | RNR `Select`; `SelectField` validates a controlled value and owns field/error association |
| Short status filters | RNR `ToggleGroup`; the required filter cannot become an empty selection |
| Boolean/exclusive choices | RNR `Checkbox`, `Switch`, `RadioGroup` rather than hand-drawn checkmarks/circles |
| Related workspace views | RNR `Tabs`; `WorkspaceTabs` keeps typed existing view IDs |
| Cards, status and feedback | RNR `Card`, `Badge`, `Alert` and their Text/content components |
| Desktop and compact navigation | Application route composition using RNR Button, Separator and Dialog |
| Record comparison | Existing TanStack table adapter, semantic HTML on web and complete compact/native records |
| Dates | Browser date input in the web adapter; shared field on native with existing domain validation |
| Loading feedback | Shared `LoadingIndicator` composes the platform activity indicator with an explicit theme color; never inherit the browser's blue default |

The reviewed RNR registry has **no Sidebar, Sheet or DataTable entry**. Do not claim those were
downloaded from it. `Sidebar` composes the installed components and actual route model; the compact
off-canvas surface uses Dialog's interaction/focus management. The table retains TanStack's row model
because replacing business comparison with generic cards would remove functionality. These adapters
represent real missing boundaries, not a parallel handmade UI kit.

Use the source APIs rather than keeping aliases for old variants. Button variants are `default`,
`outline`, `secondary`, `ghost`, `destructive` and `link`; sizes are `default`, `sm`, `lg`, `icon`.
Its `label`, `loading`, role and disabled-state support preserve existing product contracts.
Loading cannot enable an action or discard its accessible name. RNR's Text context supplies child
colors; do not hardcode dark icons or white text inside a theme-dependent primary button.

Cards and badges contain native-safe `Text`, never a string directly under a View. Alerts use
`AlertDescription` and the actual message. No failed read becomes a success-looking empty card.

### Padding belongs to the component slot

RNR Card supplies the surface and vertical spacing, not horizontal padding for arbitrary children.
Compose `CardHeader`, `CardContent` and `CardFooter`; do not put a bare form inside Card and assume
that its fields will be inset. Authentication uses the default 24 px slot padding. Compact filter
toolbars, empty-state cards and mobile record cards share 16 px horizontal slots and no decorative
shadow. Page still owns outer gutters; do not add a second page inset inside every panel.

`FilterToolbar` is a Card/CardContent composition, and `EmptyState` uses CardHeader/Description with
an optional action footer. The default cursor-page empty state is shown once, not nested inside an
empty table with another card border. Error/denied states retain their distinct copy and actions;
they must not be converted to successful empty results.

Short filter choices use the installed ToggleGroup, with 8 px separation, at least 44 px height,
12 px side padding and intrinsic item width. Do not give every item the same shrinking flex width:
long Spanish labels such as archived states must fit or wrap. Explicit responsive overrides must
not reduce the padding again on desktop. These measurements are local defaults, not WCAG rules.

Workspace tabs separate controls and results by 16 px. A pointer-focused panel does not acquire a
permanent-looking border. Keyboard focus remains visible with the neutral ring and rounded panel
corners; do not globally remove outlines to make screenshots cleaner. Informational tabs still
remain keyboard-focusable, and interactive tabs preserve their controls' tab order.

The source boundary tests also reject new raw Pressable, Switch, TextInput and ActivityIndicator
widgets in feature screens. Use the shared implementations and their RNR compositions. Ordinary
View/ScrollView layout is not a competing component library; the root startup error's system text
and the documented table/date/platform-loading adapters remain intentional exceptions.

## Necessary upstream adaptations

Aliases point at the application's existing modules. Static IBM Plex Sans 400/500/600 faces remain
`font-sans`, `font-ui`, `font-heading`; no synthetic 800/900 weight or new decorative font is added.
Input and text-area caret/selection colors use neutral theme values. Fields grow instead of clipping
large text. The startup error view keeps system text so recovery does not require the failed font.

Dialog close labels are translated. Navigation can use DialogContent's explicit overlay class and
omit its default close button when it supplies an equally accessible close action in its header.
Do not hand-build a second focus trap or intercept Escape outside the primitive contract.

The web Accordion adapter uses the existing Radix dependency directly: the installed RN Primitives
web implementation emitted duplicate hidden/visible trigger IDs. Native keeps the RNR composition.
This is a platform boundary with tests, not a silent error fallback. Product tab panels with only
informational content are keyboard-focusable. Screenshots have explicit accessible descriptions.

Uniwind's `withUniwind` is retained for the upstream Icon mapping. Do not apply it redundantly to
all compound primitives: forwarding React Native style arrays into Radix DOM slots previously broke
web rendering. Existing classes already flow through the native components where appropriate.

## Palette, typography and layout

`src/global.css` owns the RNR semantic palette. Use background/foreground, card, popover, muted,
primary, secondary, accent, input, border, ring and sidebar tokens with their matching foregrounds.
`input` means an input-border token in this registry, **not an input background**. The browser's
focus and selection colors and Expo's navigation theme are explicitly neutral; browser/framework
defaults are not an exception to the no-blue requirement.

Positive, warning and destructive colors express actual state. They are not decoration, navigation
selection or an excuse for screen-specific palettes. Source and asset checks guard against blue;
review rendered focus, overlays, images and both themes as well.

Use the installed component structure. Do not copy a card's borders/padding into every feature or
add gradients, decorative shadows, floating statistics, fake dashboards, testimonials or unverified
claims. The public page uses the same components/tokens as the application, not `brand-*` colors.

`Page` owns workspace scrolling/gutters. Desktop navigation is separate from page content. Compact
navigation exposes the same authorized modules in a menu and retains two primary destinations,
Operate and Account. A module does not become a new permanent bottom tab.

Each route has one meaningful H1. Regions and error states nested under it use lower heading levels.
Preserve readable Spanish wrapping, native text scaling, visible keyboard focus and label/error
relationships. Most actions target at least 44 px, fields 48 px; these are Pisto defaults rather
than an assertion that WCAG requires those exact dimensions. Normal text targets 4.5:1 contrast;
large-text and non-text requirements are evaluated separately.

## Domain behavior that design must preserve

Expense history filters affect history; its dates affect the independent period summary. Cash
account filters do not filter movement history. Previous-month sales totals and current receivable
positions must not masquerade as totals of a partially loaded table. Switching UI views cannot submit
or cancel a financial operation.

The server owns permissions, money, ordering, filters and cursors. Retain exact formatters, stable
record IDs, load-more states and all existing review/correction/payment paths. No client sorting or
page-count display is invented over an incomplete cursor result. Empty state requires a successful
read. Denial removes cached private data and unauthorized navigation. Preserve pending, stale,
offline, error and uncertain-confirmation behavior.

## Product assets and branding

`assets/brand/mark.json` owns the monogram geometry; `brand:generate` renders icon/favicon/splash
assets from it. Do not invent a new logo per screen. Assets must also honor the no-blue rule.

Product screenshots are static captures of actual UI with isolated example configuration and empty
forms. They show no customer records, balances or financial results. They are labeled as examples,
not live controls. Re-capture both themes after component changes and check the complete cropped
controls and alternate text. The enclosing root may restore a session, but the showcase does not
request business data. Never insert fictional records into the user's database for a screenshot.

## Validation and upgrade costs

Run `bun run check`, the dependency audit and relevant platform exports. Browser checks cover
320/390/768/1024/1440 px, both themes, long labels, populated/empty/error/denied states, keyboard tabs,
selects, menu opening/closing and restored focus. Check that the menu exposes only permitted routes.
Native exports are not installed-device tests or screen-reader acceptance.

Vitest runs web composition with actual web primitives. Its Reanimated adapter intentionally skips
animation timing; it cannot establish native behavior. Keep semantic assertions when updating old
test trees for RNR's providers. Do not remove security or state tests to make a visual migration pass.

Installed source is app-owned: upstream updates require reviewing aliases, translations, text
containment, target sizing, focus and domain contracts. No extra advisory exception is justified by
the design migration. Retain upstream MIT attribution and review dependency changes in the lockfile.

## Primary sources

- [RNR repository](https://github.com/founded-labs/react-native-reusables),
  [manual installation](https://reactnativereusables.com/docs/installation/manual),
  [CLI](https://reactnativereusables.com/docs/cli), and
  [reviewed Uniwind source](https://github.com/founded-labs/react-native-reusables/tree/385834c2196f8a303cbc9057d1ac768f3bde0a3b/packages/registry/src/uniwind/components/ui).
- [Uniwind](https://docs.uniwind.dev/), [React Native Text](https://reactnative.dev/docs/text),
  [Expo platform modules](https://docs.expo.dev/router/advanced/platform-specific-modules/).
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog),
  [Radix Accordion](https://www.radix-ui.com/primitives/docs/components/accordion).
- [W3C tables](https://www.w3.org/WAI/tutorials/tables/),
  [tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/),
  [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html),
  [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

Recheck the corresponding source and installed code when a component, styling engine, Expo SDK or
interaction contract changes. These sources establish contracts, not approval of a Pisto screenshot.
