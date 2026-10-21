Implement the supplied pesabuana design in the existing Windows Electron app.

The current 1.1.0 app works. I have tested the financial features. This task is a substantial visual and interaction redesign, with the current records and calculation behavior preserved.

Read `DESIGN-SPEC.md` in full. Open every supplied PNG as an image. Inspect and render `design-reference.html` to understand the actual type, spacing, colors, component relationships, and dialog states. Reuse the supplied local font and retain its license. The screenshots and specification are the implementation target, not optional inspiration.

Work from the actual repository. The last reported commit was `3e50a0b20dca70935ec3396d1c0a007d579be72b`; verify the current Git state rather than resetting to that commit. The private repository is https://github.com/LelaeCarl/pesabuana.git and the final branch is `main`.

Map the current renderer components, styles, calculation functions, and IPC calls before editing. Then implement reusable UI components within the existing architecture. Keep the exact-cent calculations, database, existing account, saved rates, backups, target dates, packaging identity, temporary icon, and fully offline runtime. A renderer preview must not require weakening Electron security.

The visual direction is light pearl, white surfaces, dark ink, locally bundled Inter, and a controlled vermilion accent. Apply it across Overview, Entries, Targets, Settings, dialogs, empty states, errors, and hover/focus states. Replace the current narrow text-heavy composition with the supplied broader profit workspace and compact deadline cards. Do not return a recolor of the existing layout.

Important implementation rules:

- Match hierarchy, spacing, and component proportions first. Follow the token table and breakpoint behavior in `DESIGN-SPEC.md`. Avoid oversized rounded containers, decorative gradients, thick borders, and generic decorative widgets.
- Keep complete primary RMB values readable. Show smaller equivalents as `≈ USD …` and `≈ KSh …`; avoid repeating the word "approximate" after every figure. Keep manual-rate and missing-rate behavior intact.
- Build both the populated and empty overview deliberately. The real empty account must stay empty. Never seed records to make the UI look complete.
- The reference uses sample data and a demonstration date of 12 November 2026. None of its example amounts, dates, chart points, target percentages, rates, estimates, or preview controls may be hard-coded into the installed app. Calculate production values from the existing source of truth.
- Keep the two saved operation targets exactly as they are. Do not rerun preset creation, duplicate targets, or change the start dates.
- Replace the always-visible sales/expense forms with focused entry dialogs, using the existing save/edit/delete logic. Preserve access to all existing fields, weekly/monthly summaries, filters, and confirmations.
- Keep independent exchange-rate save/remove behavior and timestamps even where the visual reference simplifies the settings controls.
- Every visible production control must work. No placeholder action, preview toast, inert filter, or static progress indicator.
- Use native Windows window controls and preserve menu and keyboard actions. No custom macOS window chrome.
- Use restrained 120–180 ms transitions only where they help. Honor reduced motion and forced colors. Never animate money counting up, replay progress from zero, or delay the appearance of data.

Complete the work in this order:

1. Inspect the implementation and establish the shared tokens, local font, app shell, money component, and buttons.
2. Finish the overview at 1440 px wide, using a separate test database for sample records. Capture and inspect a screenshot against `overview-populated.png` and `overview-empty.png`. Correct the largest differences in type scale, grid, spacing, and target treatment before moving on.
3. Carry the same components through Entries, its dialogs, Targets, and Settings. Preserve the full existing feature set.
4. Verify the actual renderer at 1280×800 and 960×700 and with enlarged Windows display scale. Reflow before reducing text. Never clip money or allow page-level horizontal overflow. Preserve keyboard focus, dialog focus return, validation, and save-failure handling.
5. Run the existing tests and focused checks for changed interactions. Verify the original money example still gives ￥300 gross and ￥250 net from ￥1,000 sales, ￥700 direct costs, and ￥50 other expenses. Verify saving/reopening, rates, target progress, backups, and offline assets.
6. Build the next appropriate version with the current Windows installer setup. Upgrade the installed copy preserving its database, existing backup, desktop shortcut, and temporary icon. Inspect the installed app and its packaged font. Do not claim an offline or Windows-scale test that you did not perform.
7. Commit the completed source, local assets, and relevant design references and push to `main` in the specified private repository. Do not force-push or overwrite remote work. Exclude personal databases, test databases, backups, secrets, dependencies, generated binaries, and installers. Verify the pushed commit.

Visual acceptance is part of completion. Use available screenshot/browser tools, or Electron/Playwright capture where appropriate. A browser rendering of the UI does not substitute for testing the installed Electron app's storage and native behavior. Do not claim success because the build passes or because you read the CSS.

Do an implementation-to-reference review before packaging: compare the actual screenshots at the same viewport, identify visible mismatches, fix them, and capture again. Apply the specific criteria in `DESIGN-SPEC.md`; stop when those criteria pass. If a reference detail conflicts with accessibility, complete money values, or an existing feature, preserve those requirements and state the smallest necessary deviation.

Report the final installer path/version, commit hash and verified push, actual tests performed, before/after screenshots, and any remaining unverified item. Implement now; do not stop after a plan or ask me to choose a design direction again.
