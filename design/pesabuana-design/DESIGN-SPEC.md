# pesabuana: Pearl / Vermilion

This is a visual implementation contract for the working Windows Electron app, currently reported as version 1.1.0. Implement it in the real application. The HTML in this folder is an inspectable design reference, not a replacement finance app.

## Reference priority

1. Preserve the existing app's tested money calculations, currency behavior, records, backups, target dates, and offline operation.
2. This document defines layout, typography, color, interaction, and acceptance requirements.
3. Match the PNGs and the HTML's rendered appearance and CSS relationships. Do not reinterpret them as loose inspiration.
4. The black design-reference banner, accent selector, empty-account switch, demonstration script, example transactions, and example dates are preview-only and disposable. Never put them in the installed app.

If a visual conflicts with a working feature, preserve the feature and adapt the layout with the smallest necessary deviation. Explain the deviation. Accessibility and complete money values take precedence over a pixel match.

## Why the present screenshots feel unfinished

- The page has a large unused outer margin while important content uses small, uniform text. At the supplied window size, the content starts about 300 pixels from the left edge.
- Net profit has too little typographic contrast with its supporting metrics.
- Nearly every USD/KSh figure repeats the word "approximate", producing more visual noise than information. Keep the meaning, shorten the presentation.
- The overview targets are uncontained blocks of labels and values. The dedicated Targets screen stretches these blocks vertically until basic actions fall below the fold.
- Entries shows two full creation forms at the same time. The records and the act of entering a record compete for the entire page.
- Settings stretches short exchange-rate inputs across hundreds of pixels. Form width does not reflect what the user types.
- A white background and thin lines alone do not create a designed interface. The current app lacks a deliberate scale, grouping, and a distinct visual element tied to the product.

The reference introduces a broad profit workspace and a narrow deadline column. The calendar-like deadline tiles are the product's distinctive element. They communicate something useful about the two operations rather than decorating the screen.

## Color tokens

Use semantic CSS custom properties in one file. Do not scatter literal values across components.

| Token | Value | Role |
|---|---|---|
| canvas | #F5F5F3 | Light pearl application background |
| surface | #FFFFFF | Content surfaces and forms |
| ink | #202124 | Primary text and money |
| muted | #676C76 | Supporting text, labels, conversions |
| line | #E4E4E2 | Subtle dividers and surface boundaries |
| accent | #C44832 | Main actions, net-profit series, target progress |
| accent-hover | #A63B29 | Hover/pressed main action |
| accent-tint | #FEF1ED | Deadline tile fill |
| positive | #22634E | Positive status when a real status is needed |
| negative | #B63737 | Validation, destructive confirmation, negative state |
| focus | #356FDB | Clearly visible keyboard focus |
| gross-series | #687386 | Gross-profit chart, dashed line |

Keep the interface in light mode. The reference's accent selector exists only to preview the effect of color. Do not build a theme picker into production.

Measured reference combinations: white on accent 4.86:1, muted on white 5.27:1, muted on pearl 4.83:1, and ink on white 16.10:1. Deadline text uses the darker accent-hover on its tint. Recheck actual computed combinations and maintain at least 4.5:1 for normal text. Structural hairlines do not carry meaning and need not look like heavy input borders. Inputs and focus indicators must remain distinguishable.

Use accent sparingly but confidently. Do not color every metric, invent a rainbow of target categories, or add random gradients. Brand accent does not mean a financial loss. Negative values retain a minus sign and a clear accessible label; never convey loss solely through color.

## Typeface and numeric formatting

Bundle `assets/InterVariable.woff2` locally, retain `assets/Inter-LICENSE.txt`, and load it using `@font-face`. Use `Inter, RmbSymbol, "Segoe UI", sans-serif`. Also bundle `assets/RmbSymbol.ttf`, a Noto Sans SC subset containing U+FFE5 (￥), and retain `assets/NotoSansSC-LICENSE.txt`. The subset prevents a missing-glyph box on systems without a suitable CJK fallback. Keep the literal ￥ character; do not replace it with an image or a guessed symbol. The font is supplied with the design package and needs no Google Fonts request.

Use a small, explicit type scale:

| Role | Desktop size | Weight | Notes |
|---|---|---|---|
| Wordmark | 23 px | 650 | Lowercase pesabuana; tight tracking; no new logo |
| Page heading | 30 px | 600 | 1.2 line height; about -1 px tracking |
| Main net profit | 62 px; up to 68 at wide widths | 550 | 1.12 line height; about -0.04 em tracking |
| Main currency symbol | 40 px | 450 | Smaller than the amount, aligned on the baseline |
| Target amount | 27 px compact; 36 px expanded | 550 | Do not truncate any digits |
| Supporting money | 21–24 px | 550 | Consistent size across the four metrics |
| Section heading | 16–18 px | 600 | Only true section headings |
| Main controls/body | 13–14 px | 400–550 | Form inputs at least 14 px |
| Labels/conversions/table metadata | 12 px | 400–500 | No essential text below 12 px in production |

A few preview-only or secondary reference annotations are 10–11 px. Keep meaningful production labels at least 12 px, allowing rows/cards to grow. Match hierarchy and alignment rather than copying tiny text. Do not solve crowding by shrinking type.

Use `font-variant-numeric: tabular-nums lining-nums` on money and numeric columns. Keep the existing exact RMB storage and formatting functions. A font change must not change number calculation or rounding.

Keep two decimal places for money. All primary amounts remain RMB with ￥. Show secondary equivalents as `≈ USD 9,637.50` and `≈ KSh 1,249,662.50`, with a single short explanation that these use the saved rates. Do not repeat ", approximate" after every amount. Preserve missing-rate prompts and make the setup action reachable by keyboard. Do not invent a rate.

For a large or negative amount, first reflow the layout or move the target column underneath; the main figure may reduce to 36 px as a last step. Never use ellipsis, clip digits, or abbreviate the primary money figure to "64.2k". Axis labels may use k with RMB units clearly identified.

## Geometry and component rules

- Work in logical CSS pixels. Keep the native Windows title bar and existing menu access; the reference depicts the app content area only.
- Content maximum width: about 1320 px, plus outer padding. Desktop outer padding: 32 px, falling to 24 px at narrower windows.
- Top app bar: 78 px in the reference, using a centered navigation group. This is separate from the native title bar. A modest height reduction is allowed where the native menu uses more space.
- Page begins 28–32 px below the app bar. Page heading and actions share a row where space permits.
- Main overview grid: flexible left column, 352–380 px target column, 24 px gap. Use `minmax(0, 1fr)` to prevent intrinsic overflow.
- Surface radius: 12–13 px. Buttons/inputs: 6–7 px. Active navigation: 6 px. These are desktop controls, not large pill shapes.
- Use at most a very subtle surface shadow. Do not use diffuse floating shadows on every element.
- Main surface padding: 24–28 px. Compact target cards: about 17 px vertical and 22 px horizontal; expanded cards 24–28 px. Repeated gaps: 8, 12, 16, 20, 24, 32 px.
- Primary/secondary buttons are 38–42 px high, with real labels. One dominant primary action per action group.
- Inputs are about 41 px high, with visible labels and focus states. Use a clear input border distinct from decorative hairlines.
- Icons, if needed, come from one locally bundled set. Use 16–18 px toolbar icons. No emoji, decorative icon disks, or unrelated illustrations.
- Keep the existing temporary application/installer icon. The reference's typeset wordmark and accent dot do not authorize replacing the `.ico`.

## Overview

Use `overview-populated.png` to understand hierarchy and `overview-empty.png` to implement the real empty state. The current real account may still be empty. An empty screen must look deliberately designed.

1. Header: Overview; selected period underneath; Add expense secondary; Add sale primary.
2. Main surface: a quiet "Net profit" label and compact date-filter controls. The existing Today, This week, This month, and Custom behaviors remain fully functional.
3. A large RMB net-profit figure, then smaller USD/KSh equivalents. This is the first thing the eye should find.
4. One four-column metric strip for Sales, Direct costs, Gross profit, Other expenses. These are a related group, not four bulky independent cards. Each keeps its conversions smaller than RMB.
5. A real gross/net profit chart integrated into the main surface. Keep the series, axes, and tooltip readable. Do not put USD/KSh on the chart.
6. Deadline column: heading "Targets", a View all action, and the existing operation cards. The reference says "Your targets"; either label is acceptable. Exact target names and dates remain unchanged.
7. Recent entries: a compact read-only view of the latest real entries with a route to Entries. No fake records when empty. Reuse the existing records API; do not create another persisted copy of entries.

When the selected period changes, update figures, supporting metrics, chart, and period description together. Targets continue to use their own periods. The recent-entry list should either respect the selected period or be explicitly labelled as all-time recent entries; choose one and apply it consistently.

If introducing the reference's cumulative chart view, derive it from the existing daily gross/net series, count each transaction once, and label it "Cumulative profit · RMB". Tooltips identify the date and both RMB values. Do not quietly turn daily data into a cumulative-looking curve. Keep the correct zero baseline and negative values. Use a solid accent net line and dashed neutral gross line so the series remain distinguishable without color. No curve smoothing that invents turning points, no fake rising trend when there are no entries, and no line plotted into future dates.

The faint area tint under the net line is optional; it can be omitted for a simpler chart. It must not look like a decorative background gradient. A real entry chart is more useful than a sparkline without axes.

Empty account: keep zero amounts, missing-rate actions where applicable, the actual target cards at zero, a neutral chart frame, and one clear "Add sale" action. Text: "Your first sale starts the chart." Supporting text: "Record a sale and its direct cost." Do not seed examples to make the screen attractive.

## Targets

The overview version is compact. It shows the exact operation name, a deadline tile, target RMB amount and conversions, profit earned, progress percentage and track, amount remaining, needed per day, days left, and a Details action.

The tile is a real date: DEC above 04 or 31. It must update when the user edits the deadline. Show the year as well in accessible text and visible context. Never leave it as a static decoration.

The dedicated Targets page has two equal columns on wide windows. Add target sits at the top. Expanded cards retain every existing target metric, including the estimate. Put editing and deletion within easy reach, not after pages of repetitive explanatory text. One shared short explanation may sit below the collection; a tooltip/detail view can hold the longer calculation explanation.

The detailed view must expose the full start date, deadline, metric (gross/net), earned amount, target, percentage, amount remaining, days left, daily requirement, estimate, and estimate explanation. Retain proper pre-start, no-data, loss, reached, exceeded, deadline-day, and overdue behavior. A task labeled Details opens details; Edit opens the real editor; Delete uses the existing confirmation flow. Do not render inert controls in production.

Existing targets are authoritative. Do not recreate presets or change their start dates:

- Operation Birthday Gift: net profit, ￥100,000, 22 Oct 2026 through 4 Dec 2026.
- Operation New Year: net profit, ￥150,000, 22 Oct 2026 through 31 Dec 2026.

Do not hard-code the reference's days left, progress, or estimate. They are illustrative fixtures dated 12 Nov 2026. Production always derives values from saved records and the app's existing local-date rules.

## Entries and entry dialogs

Use a records-first layout: period summaries and a clear table. Creation happens through Add sale / Add expense, opening one focused dialog at a time. Do not display two full blank forms next to each other all day.

Keep every existing sales/expense field, editing action, deletion action, period filter, and weekly/monthly summary reachable. The reference's three summary figures are illustrative; preserve access to the existing weekly/monthly breakdown, ideally in a compact comparison section or expandable summary below the toolbar. Do not delete functionality to achieve the screenshot.

A combined table may present date, description, type, amount in RMB, direct cost, profit impact, and actions. Expenses have no direct cost cell and reduce net profit once. Gross-profit and net-profit columns must be explicitly distinguished if both are shown. Never label the sale's gross profit as its final share of net profit without explaining separate expenses.

Rows: about 44–48 px minimum with 12–14 px text. Header is quiet; numeric columns align right. Descriptions wrap when necessary. Table overflow stays within the table surface; the application page itself must not overflow horizontally.

Entry dialog: width about 490 px, 28 px padding. Order: date, description, sale amount + direct cost, live gross-profit preview, footer Cancel + Save sale. Expense dialog uses date, description, amount, concise explanation, Cancel + Save expense. Reuse existing save and validation logic. Pressing Enter should submit a valid form once. Avoid losing unsaved edits accidentally.

Focus enters the dialog; Tab stays within it; Escape/Cancel respects unsaved edits; focus returns to the invoking control. Field errors appear next to their fields and are announced. Save disables while saving, and data is not displayed as persisted until the write succeeds. A failed save preserves the entered values.

Use simple text such as "Enter a description", "Enter a valid amount", and "Sale saved". A production successful-save toast is announced once and disappears after about 3 seconds. An error stays visible until handled. No confetti.

## Settings

Restrict form width to roughly 700–760 px inside a wider page. Short rates should not become 700 px input fields. Exchange rates, Backups, and Local records are separate modest sections.

Each rate has the actual equation `1 RMB = [value] USD` or `1 RMB = [value] KSh`. Retain independent save/remove behavior and each last-updated timestamp. The prototype's shared save button is illustrative; it must not regress the working ability to configure one rate independently.

Retain manual positive finite validation, missing rates, removal, and timestamp behavior. Save rates locally. Do not fetch them. Backup and restore remain real, with confirmation before replacing records.

Keep the storage path available under Local records, using wrapping/copyable text. It belongs in Settings, not on the main dashboard. Do not add telemetry, accounts, or synchronization.

## Motion

Motion should confirm a change, not make the app perform on every launch.

- Button/nav hover: 120–140 ms color/background transition.
- Dialog entry: optional 150–180 ms opacity + 4 px vertical movement; no bounce or scale spring.
- Save confirmation: about 120 ms appearance; no blocking animation.
- Target progress changes: optional 180 ms interpolation after an actual data update. Do not replay from zero on navigation.
- Chart values remain accurate during updates. Use the existing chart library's sensible update transition or none. No startup line drawing, staged metric reveals, or number-counting effects.
- Honor `prefers-reduced-motion: reduce`; remove nonessential movement, transitions, and delayed reveals. Honor Windows increased-contrast/forced-colors and visible native focus.
- Never use `transition: all`, animate layout continuously, or add an animation dependency just for these effects.

## Responsive behavior and Windows

- At 1280×800, profit and targets should be visible without making all text tiny. The lower recent-entry section may scroll.
- Around 1100 px, the supporting strip can become two columns if values need room.
- Around 850–1000 px, put targets beneath the main workspace instead of squeezing the left column. The exact breakpoint is content-driven; the prototype uses 850 px but real text may justify an earlier switch.
- Targets become a two-card row below the chart where it fits, otherwise a vertical list.
- Keep the same real commands at 960×700, at 125% and 150% Windows display scale, and with text enlarged. Test the resulting effective viewport as well as the physical window size.
- Long descriptions, six/seven-figure amounts, negative amounts, and long file paths must remain readable.
- Preserve native title-bar drag/resize/minimize/maximize/close and keyboard/menu actions. No fake macOS traffic lights or custom frameless window work for this redesign.

## Implementation boundary

This is a renderer/UI refactor. Start by mapping existing components and IPC/API calls. Build reusable `AppShell`, `PageHeader`, `MoneyAmount`, `MetricStrip`, `ProfitChart`, `TargetCard`, `EntriesTable`, `EntryDialog`, and `SettingsSection` components using the existing architecture.

Reuse existing source-of-truth calculations and persistence. Do not replace SQLite, introduce browser localStorage for real financial records, change amounts, change target formulas, migrate dates, add cloud services, or rebuild the app from the standalone reference. Do not disable Electron security protections to make a preview work.

The demo HTML intentionally uses local in-memory fixtures and small illustrative interactions. Its chart domain, sample dates, rate examples, target estimates, color controls, and toast messages are not production code. Its arithmetic uses ordinary JavaScript because it is a visual mockup; keep the actual application's exact-cent and decimal-safe financial implementation.

## Visual acceptance and evidence

Implement the full view, inspect the running application at the same viewport as the reference, identify the largest visible discrepancies, and correct them. Passing calculation tests alone does not finish a visual redesign.

Capture screenshots of:

1. Overview with an empty test account and missing exchange rates.
2. Overview with a populated temporary test account and saved rates.
3. Entries and an open Add sale dialog.
4. Both target cards, including a reached/overdue test state.
5. Settings.
6. A narrow window and enlarged Windows display scale.

Use synthetic data only in an isolated test database. Do not touch the user's actual database to stage visual screenshots. Do not assume test data already exists.

Verify no clipped money, no document-level horizontal overflow, no inaccessible icon-only action, no hidden primary command, no console errors, and no new runtime network requests. Keyboard and destructive-action checks must pass.

Run existing tests and focused interaction checks for changed dialogs. Then build an incremented Windows installer using the current packaging setup, upgrade the installed copy preserving data, and verify the installed renderer and packaged local font.

Commit relevant source, assets, this design contract, and suitable reference images to the private repository's `main` branch and push without force. Exclude test databases, user records, backup files, generated installers, node_modules, and secrets. Preserve remote changes and existing history. Verify the pushed commit before claiming success.

Report the installer path/version, commit hash, changed screens, actual test results, visual screenshots, and any genuine unverified items. Do not claim Windows-scale or offline tests that were not performed.

## Reference links and research notes

- Cursor image input: https://cursor.com/docs/agent/prompting#image-input
- Cursor browser screenshots and inspection: https://cursor.com/docs/agent/tools/browser
- Cursor spatial/visual prompting: https://cursor.com/docs/agent/design-mode
- Apple design reference previously used in this project: https://github.com/dickwu/apple-design-skill
- Apple typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Spotify on distinctive color, type, and product identity: https://newsroom.spotify.com/2026-04-23/spotify-design-history/
- Finexy by Sujon Hossain: https://dribbble.com/shots/26723736-Finexy-Finance-SaaS-Dashboard-Design
- Payz by Tamim for Quadrato: https://dribbble.com/shots/20635518-Payz-Financial-Dashboard
- Inter and license: https://rsms.me/inter/ and https://github.com/rsms/inter

Dribbble references informed hierarchy and separation of surfaces, not feature scope, data, arithmetic, or a pixel-for-pixel copy. No third-party design images are shipped inside this package. The pesabuana reference is original HTML/CSS built for this brief. The exact palette, dimensions, component arrangement, and motion above are design decisions for pesabuana, not claims that Apple mandates those values.
