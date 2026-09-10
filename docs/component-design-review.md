# Component design review

Date: 2026-09-10. Scope: local presentation of the existing universal app. No hosting, new product
capability, database change or authentication rule is introduced.

## User outcome and acceptance

An existing or new user reaches one clear authentication form, reads ordinary product headings,
and uses consistently styled controls. Removing decorative content must preserve labels, errors,
busy/disabled states, keyboard access, responsive layout and all existing routes/actions.

The owner's screenshot showed a lime vertical rule, shield, large promotional heading and tagline
beside the login form. These compete with the task and make a routine product screen feel like a
marketing layout. The issue was observable in Chrome and in the shared source, not just a stylistic
judgment inferred from a class name.

## Findings and implementation

| Finding | Change |
| --- | --- |
| Auth devoted 44% of wide web to a promotional panel | One centered 420 px bounded form, built from Brand, Card, Heading, Field, Button and Alert; removed promotional copy, shield, decorative rule and footer slogan |
| Shared page headings used 32/40 px black weight and tight tracking | Shared Heading variants: page 26/30 px, section 18 px, welcome 32/40 px, semibold; explicit heading level |
| Product pages had maximum widths but stayed anchored to the left | Page owns a centered bounded content area and consistent spacing |
| Light/dark colors were copied throughout features | Theme-aware semantic colors in global.css; normalized 299 repeated declarations in 58 source files, alongside shared primitive adoption |
| Controls disagreed on dark surfaces/borders | Button, Field and Card use shared surface/text/border tokens; inputs retain 48-unit minimum height |
| Inline messages repeated custom border/background markup | Alert owns error/warning appearance and announcement; auth, stale notices and billing compose it |
| Welcome and Operate repeated editorial ornament | Removed large display treatment, numbered capability panels, tracked section labels and repeated icon circles; kept meaningful module icons and permission groups |
| Billing repeated the lime heading rule | Ordinary section headings and the shared alert; existing billing availability and actions preserved |
| Report section headings inherited the page heading level | Reuse Heading with level 2 for the date selector and all report sections; retain one level-1 page heading |

Normalization is intentional, not exact color equivalence: dark body text moves from white to
`#e7eee9`, and common dark borders converge on `#34453d`. Immutable `ink`/`accent` brand colors remain
separate from foreground/background roles, so dark branded surfaces do not accidentally invert.
Some domain-specific statuses and legacy inline styles remain; this is not a claim that every visual
declaration has been migrated.

## Is the shadcn approach appropriate?

Yes: own a small, composable component layer and give it consistent defaults. Pisto already uses
React Native, CVA, `cn`, Uniwind and `@rn-primitives/slot`, which provide this foundation. The useful
change is enforcing ownership of styles and behavior at those boundaries.

The official shadcn components target web DOM elements. A direct replacement of the universal UI
with those elements would require a separate native implementation. React Native Primitives and
React Native Reusables offer the same general approach for web/iOS/Android; use their maintained
primitives when a real select, dialog, menu or other interaction requires them. No additional
package was needed for this presentation cleanup.

Owned source also means owning accessibility tests, upgrades and integration work. Installing or
copying a library does not automatically make every screen accessible or visually coherent.

## Component ownership

| Owner | Responsibility |
| --- | --- |
| global.css | Immutable brand colors and adaptive background, foreground, surface, border, input, link and status roles |
| components/ui | Control variants, typography scale, minimum control size, alert presentation and accessibility semantics |
| Page / ScreenHeader / AuthScreen | Repeated page structure and composition |
| features | Business-specific content, permissions, queries, command state and actions |
| Platform adapters | Actual platform behavior differences; not duplicated business logic |

Use component variants for visual changes. At call sites, `className` primarily positions and sizes
the component; repeated color/type overrides indicate a missing variant or incorrect ownership.
Do not create a universal screen component with a growing set of flags, or a registry/package just
because there are several feature folders. Dividers separate meaningful groups; status accents
communicate actual state. Neither is default decoration for headings.

## Commit language

At review baseline `d5c397b`, all 116 reachable commit messages were reviewed, including bodies:
97 historical commits and 19 audit commits. All are written in English. Three older bodies quote
Spanish UI labels (`e08b981`, `21814ff`, `e1b270f`); those are technical quotations, not Spanish commit
prose. History was not rewritten. New commits continue in English; product copy remains Spanish.

## Validation boundary

- `bun run check` passed: lint, documentation validation, script tests, package types/tests and web
  export. All 203 app tests passed. No financial/backend behavior or dependency changed, so the
  database integration suite was not repeated for this presentation-only slice.
- Real Chrome exercised sign-in and sign-up views, empty-field validation and `aria-invalid`,
  password visibility, busy/disabled submission, rejected credentials, successful local sign-in,
  business selection and sign-out. Synthetic existing QA data was used; no new sale was required.
  Keyboard Tab exposed a 3 px visible focus outline, and Enter activated the focused return link.
- Dark and light auth palettes were inspected. The light preview used a temporary local Uniwind
  override; the original root layout was restored byte-for-byte before final validation and export.
  No preview switch or changed theme preference ships in the app.
- Auth was inspected at 390 and 1440 CSS px; the 1440 px form heading starts at x=535 with width=370,
  within its centered 420 px card. At 390 px the document width remained 390. The loaded report at
  768 px had document width 768 and retained its confirmed $9.50 QA total. Temporary viewport
  overrides were reset after inspection.
- Browser inspection confirmed one level-1 report heading and level-2 section headings. Independent
  source review also found an inline offline heading-level issue; it was corrected before handoff.
- Final web/Android/iOS bundle export passed with exit 0 using Node 24.19 and the installed Expo CLI:
  `node ../../node_modules/expo/bin/cli export --platform all --output-dir ../../.cache/design-platform-export-final --max-workers 2`
  from `apps/app`. A previous Bun-launched all-platform export wrote files but exited 5; it is not
  counted as a passing command. Final artifacts are in the ignored cache directory. A generated
  bundle is not a signed native binary or device/screen-reader acceptance.

CSS variables use Uniwind's documented theme scopes. Separate root blocks avoid Biome mistaking
light/dark variable declarations for duplicate properties; the lint rule remains enabled.
Physical-device and screen-reader acceptance remain separate from browser/source review.

## Primary sources

- [shadcn composition and owned source](https://ui.shadcn.com/docs)
- [shadcn web Button](https://ui.shadcn.com/docs/components/button)
- [React Native Primitives](https://rnprimitives.com/)
- [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
- [Uniwind semantic theme variables](https://docs.uniwind.dev/theming/global-css)

Sources checked 2026-09-10. Recheck compatibility when adopting a new primitive or upgrading the
styling/native stack. The current dependency graph and lockfile were not changed by this slice.
