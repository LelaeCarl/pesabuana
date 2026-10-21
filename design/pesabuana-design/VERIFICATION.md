# Design reference verification

These checks apply to the supplied standalone visual reference, not the installed Windows application. The user's source repository and installed executable were not modified in this task.

- Rendered and visually inspected Overview, its empty state, Entries, the entry dialog, Targets, and Settings.
- Checked all four pages at 1440, 1280, 960, 768, 390, and 320 CSS-pixel widths with no document-level horizontal overflow.
- Verified local Inter and the local RMB symbol font load.
- Verified the sample sale dialog previews ￥300 gross profit for ￥1,000 sale amount and ￥700 direct cost. Adding the sample sale and a ￥50 expense changes sample net profit by ￥250.
- Verified changing a preview rate does not change sample RMB totals.
- Verified the empty-account view and missing-rate placeholders.
- No JavaScript page errors or HTTP/HTTPS requests occurred in the checked local reference flows.
- Screenshots use reduced-motion mode to capture settled component states.

The production implementation must still be tested inside the installed Electron application on Windows, including data preservation, actual OS display scaling, offline operation, keyboard flows, and packaging of local assets. These checks are explicitly included in CURSOR-PROMPT.md and DESIGN-SPEC.md.
