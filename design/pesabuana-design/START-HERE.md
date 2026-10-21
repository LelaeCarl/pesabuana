# pesabuana design package

1. Extract this folder into your existing project, for example `C:\Users\Sage\Desktop\pesabuana\design\pesabuana-v2`.
2. Open `design-reference.html` in a browser to explore the four screens and the entry dialog. It uses a bundled local font and no external services. The sample records are only in memory. Nothing accesses or changes your installed app's database.
3. Switch **Empty account** to see the startup state. The accent selector lets you compare vermilion with cobalt; vermilion is the specified production direction. Preview controls are not part of the installed-app requirements.
4. In Cursor Agent, attach this folder with an @ mention. Drag `overview-populated.png`, `overview-empty.png`, `targets.png`, `entries.png`, `add-sale.png`, and `settings.png` into the chat so they are supplied as images.
5. Paste the complete contents of `CURSOR-PROMPT.md` and run it in the existing project.

`DESIGN-SPEC.md` contains the detailed implementation and acceptance rules. `design-reference.html` gives inspectable markup/CSS and demonstrations of the intended layout. The HTML is a reference, not replacement production source: keep the real app's financial calculations and database implementation.

The reference depicts application content. Retain the installed app's native Windows title bar, menus, and temporary icon around it. No native controls are drawn into the mockup.

The populated view deliberately uses a sample date of 12 Nov 2026 to show mature charts and progress. The empty view uses 22 Oct 2026. Neither changes the real target start dates or the real computer's date. Sample rates match the values visible in the supplied screenshots (0.15 USD and 19.45 KSh per RMB); production must retain the user's actual saved rates.

The synthetic populated account totals are ￥124,800 sales, ￥42,400 direct costs, ￥82,400 gross profit, ￥18,150 other expenses, and ￥64,250 net profit. Both operation targets use the same eligible net profit. The demonstration chart is illustrative; production must use real observations.

All interface references in this package are original. Inter and the small Noto Sans SC RMB-symbol subset are redistributed under their included SIL Open Font Licenses. Third-party Dribbble images are research references and are not included.

Additional screenshots show the narrow layout (`overview-compact.png`) and the empty account before rates are entered (`overview-no-rates.png`). The black preview banner belongs only to this design viewer.
