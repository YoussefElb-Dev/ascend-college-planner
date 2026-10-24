# Ascend for iPhone

Ascend is a native SwiftUI iOS app. It supports iOS 17 or later, with native Liquid Glass on iOS 26 and native material surfaces on earlier versions. It does not use a web view.

The app uses the website’s pastel color values, locally bundled Plus Jakarta Sans font, and compact cards. Dark and monochrome modes use the website’s corresponding palettes. Change the theme under Workspace → Profile & appearance.

## About this IPA

`Ascend-1.1-unsigned.ipa` is a compiled ARM64 iPhone/iPad app, packaged without a signing certificate or provisioning profile. It is **not directly installable** by opening it on an iPhone. Apple requires valid signing and provisioning before an app can run on a physical device. This build does not include or request anyone's signing credentials.

To install, sign the IPA with an iOS signing/sideloading setup you control. The supported Xcode path requires a Mac and an Apple account/team: open the project, choose your team under Signing & Capabilities, select your device, and run. Distribution/TestFlight requires the appropriate Apple Developer setup. Do not send account passwords or certificates in chat. Signing and installation have not been tested without that setup.

Official Apple guide: https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices

### Windows installation option

You do not need a Mac to sign an already compiled IPA with a Windows sideloading tool. [Sideloadly](https://sideloadly.io/) supports Windows and free or paid Apple accounts. Follow its current Windows prerequisites, connect your unlocked iPhone, load this IPA, and complete signing locally in that tool. Apple account verification, device trust, and Developer Mode may require actions on your iPhone. A free account typically needs re-signing every seven days; Sideloadly offers refreshing. This app's physical-device installation is not verified until you complete that step. The tool is third-party software; Ascend does not receive its account credentials.

Alternatively, follow the official [AltStore Classic Windows setup](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Keep the same bundle identity when refreshing an installed app, and export a backup before removing or replacing an installation, because uninstalling can remove its local workspace.

## Bring your existing workspace

1. Export a JSON backup from the Ascend website's Settings.
2. Transfer the file to Files on the iPhone.
3. In Ascend, open **Workspace → Backup & transfer → Import website or app backup**.
4. Review the file and collection counts, then confirm replacement.

To move changes back, export a full backup from the app and import it in the website's Settings. Full imports replace the destination workspace; they do not merge independent copies. Export the destination first when it contains changes you want to keep. The app also retains the saved file from before its most recent import for local recovery.

Calendar `.ics` imports/exports are separate from full backups. They transfer events, recurrence rules, exceptions, UIDs and time zones; they do not transfer essays, checklists, or document attachments. Reimporting a calendar matches event UIDs and avoids duplicates. Recurring calendar events are edited in their original calendar, then imported again.

## Privacy and storage

The initial app is empty. No personal workspace, email, password, portal session, or student document is included in the app or the repository. CI previews use synthetic records only and are never loaded on a normal launch. Records save atomically in the app's local Application Support folder with iOS file protection. There is no database, analytics, or iCloud entitlement. Optional private GitHub sync is configured by the user and encrypts records before upload. iOS device backups remain subject to the user's device settings. Exported files contain private information: keep them somewhere you trust.

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

## Version 1.1: studio and automatic device sync

Workspace → Studio & tools adds courses/GPA, assignments, habits, focus history and timer, essay prompts, interview practice, weighted college comparisons, weekly reviews, submission receipts, and research notes. Workspace search spans applications and these collections. Dated schoolwork appears in the planner.

1. On the live website, unlock with **2010** and open **Workspace → Device sync**. The password is a local privacy screen, not server authentication.
2. Create a fine-grained GitHub token limited to the private `YoussefElb-Dev/ascend-private-sync` repository, with **Contents: read and write**. Enter it directly in Ascend, never in chat. Choose an expiry you can renew.
3. Connect and sync the website first. It generates a random AES-256-GCM encryption key on the first device.
4. Export the device connection, transfer it privately to the iPhone, and choose **Workspace → Device sync → Import website device connection**. The connection file contains both secrets.
5. Tap Sync now. If the app has a different workspace, save backups and explicitly choose the website/cloud copy or this device’s copy.

Saved edits sync after about 15 seconds, with checks roughly every minute while active. Closed-app iOS background syncing is not guaranteed. Conflicting changes pause for review. The app stores the token/key in iOS Keychain; workspace backups exclude them. Keep the original encryption key, because a replacement key cannot decrypt existing cloud history. Connection files should be kept privately and extra transfer copies removed. No connection or personal records are preloaded in this IPA.
