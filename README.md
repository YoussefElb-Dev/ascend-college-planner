# Ascend

A static college application planner with balanced pastel colors, self-hosted Plus Jakarta Sans, and a generated architectural brand mark. Personal records save locally by default. Optional website ↔ iPhone sync encrypts the full workspace into a separate private GitHub repository. There is no database, application backend, or telemetry.

## GitHub and Vercel

This repository contains the application and public directory data only. Personal workspaces, portal checklists, email extracts, documents, and backups must never be committed or deployed. The repository is private; the deployed application shell is publicly accessible, and each browser profile keeps records locally. The password 2010 adds a local privacy screen with idle locking; it is not server authentication or encryption of browser storage.

Import this repository into Vercel with the repository root as the root directory. `vercel.json` selects the Other framework, runs the syntax checks and automated tests, and publishes only `dist/`. No environment variables, database, server functions, or paid services are required. The application uses hash routes, so no server-side route rewrites are needed.

Use the stable production URL for daily work. Each preview URL, the original Sites address, and localhost have separate browser storage. Before moving, download a full backup from Settings at the old address, then import it from Settings at the production address. Importing replaces the destination workspace; back up any existing destination records first. Vercel deployments update the app files without replacing personal browser records at the same origin.

## Open locally

From this directory, run:

```powershell
node scripts/serve.mjs
```

Open [Ascend locally](http://127.0.0.1:5173). No package installation is needed. ES modules require HTTP; opening `dist/index.html` directly as a file is unsupported. The `dist` folder can also be served by any static HTTPS host.

## Included

- A responsive dashboard, horizontal navigation, Pastel/Dark/Black & white/System appearance, profile setup, global search (`Ctrl/Cmd+K`), and local reminders. The navigation appearance button and Settings share a live chooser; the choice persists in the browser. Black & white covers photos, status colors, and dialogs as well as the interface.
- A shared Liquid Glass-inspired material for navigation, buttons, cards, filters, forms, and dialogs, with frosted backgrounds, soft edge highlights, and solid fallbacks for unsupported blur or reduced-transparency preferences. The Plus Jakarta Sans font and established page layouts are preserved.
- A month-first planner with all six possible calendar weeks, week/day zoom, date navigation, daily notes, and personal events with times, locations, categories, repeat rules, and cancellation/archive controls. College deadlines, tasks, visits, tests, goals, follow-ups, and unpaid expenses appear alongside personal commitments.
- Browser-only iCalendar (.ics) import/export, with a change preview, stable UID matching, duplicate protection, update sequencing, recurring events, exceptions, cancellations, time zones, and multi-day dates. Limits: 2 MB and 2,000 imported event components per file. Calendar file exchange is manual; no calendar account connection or background two-way sync.
- A backward planning tool that creates six editable tasks from an application’s manually entered deadline and skips duplicate task titles.
- Activities and honors records, time commitments, character counts, manual ordering, and TXT/DOCX résumé export.
- Visit and interview planning, questions, reflections, testing plans with manually entered scores, and a contact log with follow-up dates.
- An application expense budget with planned, paid, and waived amounts, a personal spending limit, and CSV exports.
- Application CRUD, status history, rounds, pathways, deadlines with time zones, duplication, archives, notes, decisions, and separate college workspaces.
- Custom checklist items with required/optional/exempt states, weights, completion dates, and dependencies. Progress uses required applicable weight only. Starter requirements are explicitly customizable and unverified.
- Tasks with college associations, priorities, subtasks, notes, recurrence, list/board/calendar views, drag ordering, bulk completion/deletion, and archiving/restoration.
- A monthly/weekly/agenda deadline calendar and ICS export. All dates are student-entered; no fabricated institutional deadlines.
- A real offline directory of 5,836 postsecondary institutions and 37,921 high schools, fuzzy search, saved colleges, available-statistic filters, expandable profiles, and a five-college comparison with personal ratings and CSV export.
- Essay drafts with local autosave, word/character counts, categories/tags, college associations, up to 20 explicit draft snapshots, comparison/restoration, TXT/DOCX export, print-to-PDF, and clipboard copy.
- Browser-only essay review metrics, repeated-word highlights, a saved revision checklist, and six original brainstorming exercises that create editable drafts.
- Local document uploads, organization, renaming, image/text previews, downloads, and deletion. PDFs and DOCX can be downloaded to their native viewer.
- Recommendation requests, scholarships, financial aid checklists, annual cost/offer comparisons, notes, and optional QuestBridge ranking/status tracking. Editing an Ascend record does not send or submit anything.
- Full JSON backup/import including documents, applications CSV, backup validation, storage failure messages, and recovery protection for unreadable stored data.
- Real campus photos and descriptions from Wikipedia/Wikimedia Commons, with a 12-school public metadata seed, free-use image licenses, attribution, and verified official-domain matching for additional schools. Profiles expand into overview, tuition/aid, admissions/outcomes, campus, notes, and sources.
- Self-hosted, open-license Plus Jakarta Sans, local SVG icons, reduced-motion support, native modal focus management, keyboard navigation for application tabs, and offline asset caching after a successful initial load.

## Data and privacy

The directory is a bundled federal reporting snapshot, not a live admissions source. [DATA-SOURCES.md](DATA-SOURCES.md) documents downloads, exact reporting periods, inclusion rules, and known gaps. Missing values are shown as unavailable. Program offerings, current test policies, deadlines, scholarships, and admission outcomes are never inferred. Optional public Wikipedia and Wikimedia Commons APIs supply college descriptions and images. These requests contain public institution identifiers only, omit credentials and referrers, and never include workspace records or uploaded files. Public metadata is cached separately in the browser (up to 80 records). Network or identity-match failures show a federal-data summary and an explicit photo fallback. The app remains usable without those services.

Your workspace belongs to a particular browser profile and site origin. The local preview and hosted app have separate storage. Clearing browser site data, private browsing, or switching browsers/devices can remove or separate records. Use **Settings → Download full backup** regularly, and import it to move devices. Backups contain private documents in plain JSON; keep them private. Other people with access to the same browser profile can access your records.

File limits are 1 MB per file and 3 MB of raw documents total. Browser storage capacity varies and base64 file encoding adds overhead. Ascend reports failed writes and rolls changes back rather than claiming a save succeeded. Optional sync uploads only an AES-256-GCM encrypted workspace file, including its documents, to the chosen private repository.

The service worker caches static application files and public directory assets only. Personal records never enter the HTTP cache, source repository, or hosting deployment. College photos load from Wikimedia image hosts, and optional metadata requests use the Wikipedia and Commons APIs. Official resource links open in separate tabs only when selected. No emails, push reminders, college submissions, or AI writing services are invoked.

## Verification

```powershell
node --check dist/app.js
node --test scripts/*.test.mjs
node scripts/import-directory.mjs --validate
```

Run the automated checks with `node --run check`. Browser QA covered the original workflows, the new planning tools, backup compatibility, desktop and mobile routes, keyboard navigation, overflow, and dark mode. Test fixtures are synthetic and are not included in the initial workspace. See `QA.md` for results and limits.

## Directory maintenance

```powershell
node scripts/import-directory.mjs
```

The build-time importer retrieves pinned official public datasets. It never sends student information or runs in the browser. Review the source definitions before updating dataset releases. Local application data needs no schema migration for a directory refresh.

Font licenses are in `dist/fonts/`. Interface icons use locally embedded Lucide-style stroke paths; institutional monograms are neutral text fallbacks, not invented university logos.

Calendar parsing and recurrence use the vendored `ical.js` 2.2.1 ES module from the official npm release, under MPL-2.0; its source and license are in `dist/vendor/`. No package is fetched at runtime. Imported sub-daily repeat rules are retained for export but displayed as a single occurrence; unsupported entries and preview safety limits produce notices. Imported alarms and other calendar properties are preserved as file data but are not executed as background notifications.
## Portal setup checklist

Tasks categorized as `Portal setup` appear on Home with direct portal links, editable steps, personal target dates, and a completed section. Completing or reopening a card updates its existing task. Financial aid records support `Not verified` so an unreviewed receipt is not presented as a confirmed missing submission.

Settings also supports pasting a JSON backup when file selection is unavailable. File and text imports share the same 12 MB limit and schema validation, preview the record counts, and download the current workspace before replacing it. Both import routes run entirely in the browser.

## Native iPhone app

The `ios/` project is a native SwiftUI companion, with Today, college/application checklists, month/week/day planning, personal events, day notes, essays and version history, local documents, financial aid and the other workspace collections. It supports iOS 17+, native Liquid Glass on iOS 26, and light/dark/monochrome appearances. It uses no web view or remote database.

Optional encrypted private GitHub sync connects the website and iPhone while open/active. Full JSON backups also transfer the complete workspace manually between devices. `.ics` import/export exchanges calendar events and deadlines. Full imports preview their contents, replace the destination workspace, and retain the previous saved file locally for recovery. Private student records are never bundled in the app or checked into this repository; CI uses synthetic fixtures only.

The **Native iOS app** Actions workflow builds an unsigned ARM64 IPA on a hosted Mac, runs cross-platform backup compatibility tests and native iPhone simulator UI tests, and saves screenshots/build reports as a private artifact. An unsigned IPA needs signing before it can run on a physical iPhone. See [iPhone build, installation and transfer instructions](ios/INSTALL.md), including Windows sideloading options and Xcode setup.


## Studio and private device sync · version 1.1

Ten additional tools cover courses and credit-weighted GPA, assignments, seven-day habit check-ins and streaks, focus history, supplemental essay prompts, structured interview practice, weighted personal college ratings, weekly reviews, submission receipts, and a research library. A persistent focus timer, submission review, native workspace search, archived-record recovery, and website CSV exports connect these tools. Dated assignments, prompts, and interview practice appear in the planner. Older backups acquire empty new collections without losing existing fields.

Device sync uses GitHub Contents read/write access to a separate **private** repository and a random 32-byte encryption key. AES-256-GCM authenticates the workspace before either device accepts it. The website keeps connection secrets in its browser profile; the native app uses Keychain. Connection exports include the token and key and must be transferred privately. Ordinary workspace backups exclude them. Use a fine-grained token limited to only `ascend-private-sync`; no token or personal workspace is bundled or committed.

Set up the website first at **Workspace → Device sync**, then import its connection file into **iPhone → Workspace → Device sync**. Automatic checks occur approximately once a minute while unlocked/open or active, and saved edits debounce for 15 seconds. Different edits on both devices pause for explicit review and allow exporting both copies before replacement. GitHub SHA conditions prevent overwriting an unseen remote edit. No closed-app iOS background guarantee is made. Manual backups and calendar import/export remain available.
