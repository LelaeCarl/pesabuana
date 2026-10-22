# pesabuana

pesabuana is a personal Windows app for sales, direct costs, other expenses, and profit targets. It runs offline. There is no login and no cloud sync.

Amounts are stored in RMB. You can type your own USD and KSh rates. Those rates only change the smaller figures under the RMB amounts. They do not change stored amounts, profit, or target progress.

## Records

The installed app keeps records at:

`%APPDATA%\pesabuana\pesabuana.sqlite`

On this computer that is `C:\Users\Sage\AppData\Roaming\pesabuana\pesabuana.sqlite`. The program itself is in `%LOCALAPPDATA%\Programs\pesabuana`. The two folders are separate, so updating or reinstalling the app leaves the records in place.

To move records to another laptop, open Settings and choose Back up data. Copy that file yourself. On the other computer, install pesabuana, open Settings, and choose Restore backup. Confirm before it replaces the account there.

A backup includes entries, expenses, expense categories, targets, the currency, and exchange rates with the time they were last changed.

## Week and month comparisons

On Overview, This week and This month show a comparison under the main figures. This week compares Monday through today with the same weekdays last week. This month compares the first of the month through today with the same number of days last month. If last month is shorter, both sides use that shorter length, and the comparison says so. The large profit figure still covers the whole selected week or month. Today and Custom do not show the comparison. Amounts stay in RMB.

## Expense categories

A new expense needs a category. The built-in list includes Taxes as a label only. The app does not calculate tax. You can add, rename, archive, and restore categories in Settings. Existing expenses without a category stay Uncategorised until you choose one. Archiving hides a category from new expenses and keeps the old records.

## Exchange rates

Settings has two rates:

- 1 RMB = a USD amount
- 1 RMB = a KSh amount

Enter only a positive number. Each rate is saved on its own. If a rate is missing, the app shows "Set exchange rates" for that currency. Converted figures are marked approximate. The app does not download rates.

## Targets

Two targets are added once for a new RMB account:

- Operation Birthday Gift: net profit of ￥100,000.00 from 2026-10-22 through 2026-12-04
- Operation New Year: net profit of ￥150,000.00 from 2026-10-22 through 2026-12-31

Both measure net profit from the same start date. ￥150,000 is the total for the New Year target, not an extra amount on top of the birthday target. The same profit can count toward both. Deleting or editing a target is kept. Opening the app again does not put a deleted target back.

You can also add your own gross-profit or net-profit targets.

Days left, while a target is active, include today through the deadline. The estimate uses the average daily profit since the start date, including days with no entries. It stops at the deadline.

## Development on another Windows laptop

Install Node.js 22, which includes npm. Git is useful for cloning. A C++ compiler is not required.

```bash
git clone https://github.com/LelaeCarl/pesabuana.git
cd pesabuana
npm install --legacy-peer-deps
npm test
npm start
```

`npm start` opens the desktop window from the last build in `dist`. After you change the interface, build it first:

```bash
npm run build
npm start
```

`npm run dev` starts the web preview on port 5173. The desktop window uses that preview only when `PESABUANA_DEV_SERVER=1` is set.

## Windows installer

```bash
npm run dist
```

The installer is written to `release/pesabuana-setup-<version>.exe`. It installs for the current user, adds a desktop shortcut, and adds a Start menu entry. Installing a newer version over the current one keeps the records in the AppData folder.
