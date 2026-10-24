import SwiftUI
import UniformTypeIdentifiers

struct TransferView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var calendarMode: Bool
    @State private var importing = false
    @State private var exporting = false
    @State private var exportDocument = TransferFile()
    @State private var exportType = UTType.json
    @State private var exportName = "ascend-backup"
    @State private var pending: Workspace?
    @State private var importSummary = ""
    @State private var sourceName = ""
    @State private var completion: String?
    init(initialCalendar: Bool = false) { _calendarMode = State(initialValue: initialCalendar) }
    var body: some View {
        ZStack {
            PageBackground()
            Form {
                Section {
                    Label("Your workspace stays with you", systemImage: "lock.shield").font(.appHeadline)
                    Text("Ascend saves on this iPhone. Transfer a full JSON backup manually, or connect optional encrypted private GitHub sync to exchange your workspace with the website while active.").font(.appBody).foregroundStyle(colors.muted)
                    NavigationLink("Set up device sync") { DeviceSyncView() }
                }
                Section("What would you like to transfer?") { Picker("Format", selection: $calendarMode) { Text("Full workspace").tag(false); Text("Calendar (.ics)").tag(true) }.pickerStyle(.segmented) }
                if calendarMode {
                    Section("Calendar import & export") {
                        Text("Exchange events with Apple Calendar, Google Calendar, Outlook, or any app that supports iCalendar. Imported events keep their UIDs, recurrence rules, exceptions, and time zones. Reimporting the same calendar does not duplicate events.").font(.appBody).foregroundStyle(colors.muted)
                        Button { importing = true } label: { Label("Import calendar file", systemImage: "square.and.arrow.down") }.disabled(store.recoveryRequired || store.calendar == nil)
                        Button { exportCalendar() } label: { Label("Export events & deadlines", systemImage: "square.and.arrow.up") }.disabled(store.recoveryRequired || store.calendar == nil)
                        Text("Calendar files contain events only. Use a full workspace backup for application records, essays, documents, and checklists. Changes are exchanged manually.").font(.appCaption).foregroundStyle(colors.muted)
                    }
                } else {
                    Section("Full workspace") {
                        Button { exportBackup() } label: { Label("Export full backup", systemImage: "square.and.arrow.up") }.disabled(store.recoveryRequired)
                        Button { importing = true } label: { Label("Import website or app backup", systemImage: "square.and.arrow.down") }
                        Text("Import replaces this device’s workspace after a preview. Export first if this device has changes you want to keep. Backups may contain essays, documents, and personal information; store them privately.").font(.appCaption).foregroundStyle(colors.muted)
                    }
                    Section("Move from the website to iPhone") {
                        step(1, "On the website, open Settings and export a backup.")
                        step(2, "Save the JSON file to Files on your iPhone.")
                        step(3, "Choose Import here, review the counts, then replace this workspace.")
                        SafeLink(title: "Open your Ascend website", address: "https://ascend-college-planner.vercel.app/#settings")
                    }
                    Section("Move from iPhone to the website") { step(1, "Export a full backup here and save or share the JSON file."); step(2, "In the website’s Settings, import that backup."); Text("If you edit both copies, choose which one is the latest before transferring. A full backup import does not merge two workspaces.").font(.appCaption).foregroundStyle(colors.muted) }
                    Section("On this iPhone") {
                        ForEach(["applications", "tasks", "essays", "documents", "events"], id: \.self) { key in LabeledContent(key.capitalized, value: String(store.workspace.all(key).count)) }
                        Text(store.lastSaved.map { "Last saved " + $0.formatted(date: .abbreviated, time: .shortened) } ?? "Saved data loads automatically when you reopen Ascend.").font(.appCaption).foregroundStyle(colors.muted)
                    }
                }
                if store.recoveryRequired { Section("Recovery") { Text("The original file is preserved and editing is paused. Export it before importing a known good backup.").font(.appBody); Button("Export preserved file") { if let data = store.originalData { prepareExport(data, name: "ascend-recovery-" + DateKey.today, type: .json) } } } }
                if FileManager.default.fileExists(atPath: store.directory.appendingPathComponent("before-last-import.json").path) {
                    Section("Previous import") { Button("Export workspace from before the last import") { do { prepareExport(try Data(contentsOf: store.directory.appendingPathComponent("before-last-import.json")), name: "ascend-before-last-import", type: .json) } catch { store.error = error.localizedDescription } }; Text("Kept locally as a recovery copy. Import it to restore that version.").font(.appCaption).foregroundStyle(colors.muted) }
                }
                if let completion { Section { Label(completion, systemImage: "checkmark.circle").font(.appBody) } }
            }.scrollContentBackground(.hidden)
        }.navigationTitle("Backup & transfer").navigationBarTitleDisplayMode(.inline)
            .fileImporter(isPresented: $importing, allowedContentTypes: calendarMode ? [UTType(filenameExtension: "ics") ?? .data] : [.json], allowsMultipleSelection: false) { result in handleImport(result) }
            .fileExporter(isPresented: $exporting, document: exportDocument, contentType: exportType, defaultFilename: exportName) { result in if case .failure(let error) = result { store.error = error.localizedDescription } else { completion = "Export saved. Import it on your other device to transfer changes." } }
            .sheet(isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } })) { previewSheet }
    }
    private func step(_ number: Int, _ text: String) -> some View { HStack(alignment: .top, spacing: 12) { Text("\(number)").font(.appCaption.weight(.semibold)).frame(width: 25, height: 25).background(colors.lavender.opacity(0.4), in: Circle()); Text(text).font(.appBody) } }
    private func prepareExport(_ data: Data, name: String, type: UTType) { exportDocument = TransferFile(data); exportName = name; exportType = type; exporting = true }
    private func exportBackup() { do { prepareExport(try store.workspace.encoded(exported: true), name: "ascend-backup-" + DateKey.today, type: .json) } catch { store.error = error.localizedDescription } }
    private func exportCalendar() { do { guard let engine = store.calendar else { throw WorkspaceError.invalid("Calendar engine could not load.") }; let text = try engine.export(store.workspace.records("events"), linked: store.workspace.linkedCalendarEntries()); prepareExport(Data(text.utf8), name: "ascend-calendar-" + DateKey.today, type: UTType(filenameExtension: "ics") ?? .plainText) } catch { store.error = error.localizedDescription } }
    private func handleImport(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size <= (calendarMode ? 2 * 1024 * 1024 : Workspace.maximumBytes) else { throw WorkspaceError.invalid("This file exceeds the import size limit.") }
            let data = try Data(contentsOf: url); sourceName = url.lastPathComponent
            if calendarMode {
                guard let text = String(data: data, encoding: .utf8), let engine = store.calendar else { throw WorkspaceError.invalid("Choose a UTF-8 iCalendar file.") }
                let parsed = try engine.parse(text, name: sourceName), incoming = (parsed.object["records"]?.array ?? []).map { Entry($0.object) }
                let merged = try engine.merge(store.workspace.all("events"), incoming: incoming)
                var next = store.workspace; next.set("events", (merged.object["records"]?.array ?? []).map { Entry($0.object) }); try next.validate()
                importSummary = "\(Int(merged.object["added"]?.number ?? 0)) new · \(Int(merged.object["updated"]?.number ?? 0)) updated · \(Int(merged.object["unchanged"]?.number ?? 0)) unchanged · \(Int(merged.object["older"]?.number ?? 0)) older versions ignored\n\(Int(parsed.object["skipped"]?.number ?? 0)) unsupported events skipped.\n" + (parsed.object["warnings"]?.array.map(\.text).joined(separator: "\n") ?? "")
                pending = next
            } else { let next = try Workspace.decode(data); importSummary = "This replaces the current workspace on this iPhone. The previous saved file will remain available below as a recovery export."; pending = next }
        } catch { store.error = error.localizedDescription }
    }
    private var previewSheet: some View {
        NavigationStack {
            Form {
                Section("Review import") { Text(sourceName).font(.appHeadline); Text(importSummary).font(.appBody).foregroundStyle(colors.muted) }
                if let w = pending { Section("Workspace after import") { ForEach((Workspace.required + Workspace.optional).filter { !["favorites", "compare"].contains($0) && !w.all($0).isEmpty }, id: \.self) { key in LabeledContent(RecordSpec.title(key), value: String(w.all(key).count)) } } }
                Section { Button(calendarMode ? "Apply calendar updates" : "Replace this workspace", role: calendarMode ? nil : .destructive) { do { guard let w = pending else { return }; try store.replace(with: w); pending = nil; completion = "Import complete. Your workspace is saved on this iPhone." } catch { pending = nil; store.error = error.localizedDescription } }.accessibilityIdentifier("confirmImport") }
            }.navigationTitle("Import preview").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { pending = nil } } }
        }
    }
}
