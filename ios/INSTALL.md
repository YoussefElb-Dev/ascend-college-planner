# Ascend for iPhone

Ascend is a native SwiftUI iOS app. It supports iOS 17 or later, with native Liquid Glass on iOS 26 and native material surfaces on earlier versions. It does not use a web view.

## About this IPA

`Ascend-1.0-unsigned.ipa` is a compiled ARM64 iPhone/iPad app, packaged without a signing certificate or provisioning profile. It is **not directly installable** by opening it on an iPhone. Apple requires valid signing and provisioning before an app can run on a physical device. This build does not include or request anyone's signing credentials.

To install, sign the IPA with an iOS signing/sideloading setup you control. The supported Xcode path requires a Mac and an Apple account/team: open the project, choose your team under Signing & Capabilities, select your device, and run. Distribution/TestFlight requires the appropriate Apple Developer setup. Do not send account passwords or certificates in chat. Signing and installation have not been tested without that setup.

Official Apple guide: https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices

## Bring your existing workspace

1. Export a JSON backup from the Ascend website's Settings.
2. Transfer the file to Files on the iPhone.
3. In Ascend, open **Workspace → Backup & transfer → Import website or app backup**.
4. Review the file and collection counts, then confirm replacement.

To move changes back, export a full backup from the app and import it in the website's Settings. Full imports replace the destination workspace; they do not merge independent copies. Export the destination first when it contains changes you want to keep. The app also retains the saved file from before its most recent import for local recovery.

Calendar `.ics` imports/exports are separate from full backups. They transfer events, recurrence rules, exceptions, UIDs and time zones; they do not transfer essays, checklists, or document attachments. Reimporting a calendar matches event UIDs and avoids duplicates. Recurring calendar events are edited in their original calendar, then imported again.

## Privacy and storage

The initial app is empty. No personal workspace, email, password, portal session, or student document is included in the app or the repository. CI previews use synthetic records only and are never loaded on a normal launch. Records save atomically in the app's local Application Support folder with iOS file protection. No database, analytics, account connection, iCloud entitlement, or automatic cloud sync is configured. iOS device backups remain subject to the user's device settings. Exported files contain private information: keep them somewhere you trust.

Campus photos/descriptions use public Wikipedia/Wikimedia endpoints, sending the college's public name only. Public directory data is bundled for offline searching. Tuition and outcomes are reporting snapshots; verify current figures with the institution. Photos require connectivity and may be unavailable. Sources and image licenses are displayed in profiles.

## Build without a local Mac

The private repository's **Native iOS app** GitHub Actions workflow compiles on a hosted Mac, runs the website tests and Swift compatibility tests, builds an unsigned device app, and runs native iPhone simulator UI tests. Download the **Ascend-native-iOS** artifact from a successful run. The artifact includes the IPA, SHA-256 checksum, simulator screenshots, build logs and `.xcresult` test report. This uses ordinary hosted runner allowance; it does not configure paid build services or change billing.

## Build in Xcode

From the repository root on a Mac with Xcode 26.3 or newer and Node.js:

```sh
node ios/scripts/prepare.mjs
swift ios/scripts/icon.swift "$PWD/ios"
node ios/scripts/project.mjs
open ios/Ascend.xcodeproj
```

The resource preparation copies only the public directory, public campus media and existing calendar engine from `dist/`. No app data is read from browser storage. The app has no third-party Swift packages. The calendar engine uses the same vendored Mozilla ical.js as the website inside JavaScriptCore; its license is bundled in the engine source.

```sh
node ios/scripts/fixtures.mjs
swift test --package-path ios
xcodebuild -project ios/Ascend.xcodeproj -scheme Ascend -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

Use `--preview` as an Xcode launch argument only when you want disposable synthetic records for screenshots. Preview changes are never written to the real workspace.
