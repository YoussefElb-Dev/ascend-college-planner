# Verification

Verified October 22–23, 2026 (America/New_York), including the balanced palette, restored Plus Jakarta Sans, month-first personal planner, calendar file exchange, and public university media.

## Automated checks

`node --test scripts/*.test.mjs` — all 30 tests passed:

- Full local-storage save/reload, including essay text and document bytes.
- Storage quota errors propagate to the application.
- Backup schema, duplicate IDs, attribute injection, unsupported document types, and malformed essay history are rejected.
- Required checklist weighting excludes optional/exempt items.
- Monthly recurrence clamps correctly at month-end and leap years.
- ICS escapes student text and retains calendar dates and explicit IANA time zones.
- School search supports aliases, acronyms, and small misspellings.
- URL protocol handling and whitespace word counts.
- DOCX OOXML ZIP structure, Unicode, and XML escaping.
- Personal-state modules contain no remote storage, analytics senders, or database SDKs. Optional public college media uses explicitly allowed Wikipedia/Wikimedia sources.
- Old version-1 backups migrate with empty new collections; complete backups retain new records, private document bytes, budget settings, and essay review checklists.
- New collection validation rejects invalid structures, unsafe IDs, invalid dates, and nonfinite amounts.
- Expense totals separate planned, paid, waived, and archived records.
- Backward planning uses calendar dates across leap days and year boundaries.
- Calendar sources include new planning tools and exclude completed, canceled, paid, waived, and archived records.
- Essay review handles blanks, paragraphs, repeated words, and over-limit drafts.
- New planning modules use no external requests or remote storage.

`node scripts/import-directory.mjs --validate` — 5,836 unique college IDs and 37,921 unique school IDs passed. The importer’s source comparison also checked 19,263 statistics against official values during ingestion.

## Browser checks

Performed in the in-app browser against the local static server. Synthetic QA records were entered only in local preview storage, not bundled into source or the hosted app.

| Workflow           | Verified result                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Application        | Added college name, intended major, status, and a manually entered deadline; full workspace opened                |
| Checklist          | Starter checklist created; completing 1 of 9 items produced 11%; progress survived reload                         |
| Essay              | Draft created; 11 words / 64 characters autosaved and survived reload                                             |
| Tasks              | Completing a weekly task dated November 1 created the next occurrence dated November 8                            |
| Documents          | A generated TXT test fixture stored in browser storage and survived reload                                        |
| College search     | MIT resolved to the official IPEDS record; profile showed available Scorecard figures                             |
| High-school search | Stuyvesant returned real federal directory records                                                                |
| Global search      | Grouped school/page results opened the correct workspace                                                          |
| Financial aid      | $50,000 cost minus $15,000 grants and $5,000 scholarships showed $30,000 net cost; $5,500 loans remained separate |
| Backup             | Full backup downloaded and validated; import reviewed counts, backed up the old state, and restored the workspace |
| Expanded backup    | Downloaded backup validated with every new collection, a document, budget limit, and saved essay review check     |
| Weekly planner     | Test and visit appeared on the correct days; completing a goal updated the weekly total                           |
| Backward plan      | Six Princeton tasks generated at the expected offsets from the January 1 deadline                                 |
| Activities         | Activity and honor saved with hours/weeks/impact; résumé DOCX downloaded                                          |
| Budget             | $75.50 paid against a $300 budget showed $224.50 remaining                                                        |
| Visits/testing     | Booked visit with questions and a preparation-stage exam saved and appeared in the planner                        |
| Contacts           | Mentor and follow-up date saved and appeared among upcoming commitments                                           |
| Essay review       | Draft metrics and checklist rendered; checked revision item survived reload; brainstorm created an editable draft |
| Application tabs   | All eight tabs rendered; ArrowRight selected and focused the next tab                                             |
| Mobile             | 390 × 844: all main routes fit without horizontal page overflow; menu exposed all destinations and reminders      |
| Desktop            | 1280-pixel viewport: all main routes fit without horizontal page overflow; no captured console errors             |
| Dark mode          | Dashboard and planner inspected; light theme restored afterward                                                   |

Browser QA is representative, not an exhaustive cross-browser or accessibility audit. Native print/PDF and import into third-party calendar apps were not exercised; the Ascend import/export workflow was tested with generated .ics fixtures and parsed downloads. Offline cache behavior is implemented but was not tested by disconnecting the device. File quotas and private browser persistence depend on the browser.

## Current release checks

- Calendar model: duplicate import, stable local IDs on updates, stale-sequence rejection, weekly recurrence with excluded dates, moved/canceled exceptions, all-day multi-day exclusive end dates, Unicode and escaped notes, duration-based events, cancellation updates, IANA daylight-saving conversion, mixed-zone end times, invalid files, and migration of older backups.
- Month planner: October/November navigation displayed 42 date cells; weekly volleyball appeared on the correct dates with location and notes. Week zoom displayed 7 columns; day zoom displayed all 24 hours. Daily notes survived navigation and reload.
- Calendar import: first fixture import showed 1 new event; repeating the import showed 0 new, 0 updates, 1 unchanged. Weekly imported games appeared on October 27 and November 3 in the October grid, and on three dates in the November grid.
- Calendar export: downloaded file parsed into 13 records with two repeating series, stable UIDs, notes, and America/New_York time zones. College items remained separate from the personal series.
- University media: all 12 curated entries resolve to real directory IDs and freely reusable, attributed campus images. MIT, Princeton, Stanford, Howard, Michigan, and ASU image elements reported loaded natural dimensions in the browser. MIT showed $64,730 tuition and fees for 2025–26, fall-2024 enrollment, and six expandable sections with official links and source credits.
- Responsive: 390 × 844 viewport checked 15 routes, including the new planner and university profile, without horizontal page overflow. The month grid fits all 7 columns on mobile; Week uses contained scrolling. Desktop checked at 1280 pixels.
- Light/dark views inspected, then the light appearance restored. No captured JavaScript errors during the current responsive route checks.

Public image availability depends on Wikimedia. Missing or unverified images use an explicit fallback; they are never replaced with unrelated stock photos. Third-party calendar apps control their own import duplicate handling and cancellation interpretation.

## Glass and monochrome appearance update

- All 30 automated tests and syntax checks for every application JavaScript module passed.
- The shared chooser updates immediately, marks the selected option accessibly, and keeps keyboard focus on the selected option. Black & white survived reload. System resolved to the device's dark preference; Pastel and Dark remained individually selectable.
- Desktop inspection covered the pastel dashboard, monochrome college directory with loaded grayscale campus photos, the monochrome appearance dialog, and the dark month planner. The original Plus Jakarta Sans font remains active.
- At 390 × 844, the appearance dialog, mobile navigation, Settings tiles, and month/week/day planner controls remained usable. Settings and planner had no horizontal page overflow, and the month view retained all 42 date cells. Event fields opened correctly in the glass dialog.
- CSS provides solid-material fallbacks for unsupported backdrop filters, reduced-transparency settings, and forced colors. Device-level accessibility preference changes and non-Chromium browsers were not exercised.

## Native iPhone release — compact website appearance

- Source: a09cdb4. [Successful private iOS build](https://github.com/YoussefElb-Dev/ascend-college-planner/actions/runs/40055984517). Built with Xcode 26.3; unsigned device executable verified as ARM64.
- Website checks: 31 tests passed. Seven native Swift tests cover backup round trips, invalid data rejection, checklist dependencies, task recurrence, calendar recurrence/exceptions, and time-zone conversion. Native-exported JSON also passes the website validator and preserves every synthetic fixture field.
- Three native UI tests passed on the iPhone 17 Pro simulator, with zero failures. They exercise navigation, month/week/day zoom, event creation, checklist completion/reopening, college profiles, backup controls, and monochrome/dark launches. The month test confirms the selected day's volleyball event is visible without scrolling past the calendar.
- Actual simulator screenshots reviewed for Today, Colleges, Month, College profile, monochrome, and dark mode. The app uses the website's pastel/dark/monochrome color values and bundled Plus Jakarta Sans variable font. Page spacing is 12 points, panel padding 14, application card padding 12, and calendar date targets remain at least 44 points high.
- Final IPA SHA-256 matches the CI checksum. Its package includes the website font, font license and privacy manifest, and contains no personal backup, workspace file, test fixture, or provisioning profile. Preview records are synthetic and only activated by the preview launch argument.
- Complete workspaces transfer manually through JSON backup preview/confirmation. Calendar files transfer separately through ICS with UID matching. No automatic cloud sync, database, account connection, or iCloud entitlement is configured.
- Physical-device signing, installation and refresh remain unverified because no Apple signing environment is connected. The compiled IPA requires signing before it can run on an iPhone; Windows installation options are documented in ios/INSTALL.md. Native file-picker transfer and real-device accessibility/device settings were not exhaustively tested.

## Version 1.1 · Studio, generated branding, privacy lock, private sync

Release source: `505e5b6`. Successful hosted Mac build and native tests: https://github.com/YoussefElb-Dev/ascend-college-planner/actions/runs/40065455345 .

- 40 website tests pass, including new collection validation, GPA, streaks, weighted ratings, planner inclusion, AES-GCM tampering/wrong-key rejection, and conditional GitHub writes.
- 12 Swift Core tests pass. JavaScript-encrypted fixtures decrypt in CryptoKit, and native-encrypted exports decrypt in the website engine without losing fixture fields.
- 5 native UI tests pass on iPhone 17 Pro / iOS 26.2: planner/event editing, checklist/profile, appearance, Studio/habit check-ins/focus timer, device setup and workspace search. Fifteen screenshots are included in the private build artifact.
- Browser QA verified incorrect/correct password, reload locking, course create/archive/restore with recalculated GPA, habit check-ins/streak, a real one-minute focus session saved to history, and Studio search opening its matching record. Production Vercel serves the new logo and tools.
- A synthetic encrypted create/read/update check against the private sync repository passed; a stale SHA was rejected with HTTP 409. The synthetic file was removed.
- The user completed the limited GitHub token setup directly. The real website reports Up to date. Its exported iPhone connection successfully decrypts the live encrypted cloud copy, preserving all 12 applications. Credentials were not printed or committed. The user also reported that website and app work.
- Final unsigned ARM64 IPA: `Ascend-1.1-unsigned.ipa`, 4,003,305 bytes, SHA-256 `8b9f75801888c1895eb0dd5c9942c319b25113bb378b13a2ca4d2631de6355b1`. Inspected ZIP: native executable, bundled font and tools resource, no provisioning profile, personal workspace, connection file, or embedded GitHub PAT.

Limits: the 2010 website screen is a local privacy lock, not server authentication or browser-storage encryption. Cloud records use AES-256-GCM with a random key. Sync runs while open/unlocked or active; closed-app iOS background sync is not guaranteed. New devices must import the private connection once. The limited token expires November 23, 2026 and requires renewal. The IPA requires signing before a physical-device installation; simulator checks are independent of the user’s reported app result. Manual full backups and calendar file exchange remain available.
