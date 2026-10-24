import SwiftUI
import UniformTypeIdentifiers

@MainActor final class WorkspaceStore: ObservableObject {
    @Published private(set) var workspace: Workspace = .empty
    @Published var error: String?
    @Published private(set) var recoveryRequired = false
    @Published private(set) var lastSaved: Date?
    @Published var tab = 0
    private(set) var originalData: Data?
    let directory: URL
    let preview: Bool
    let calendar: CalendarEngine?
    var file: URL { directory.appendingPathComponent("workspace.json") }
    var name: String { workspace.profile.text("name").split(separator: " ").first.map(String.init) ?? "there" }
    var isEmpty: Bool { Workspace.required.filter { !["favorites", "compare"].contains($0) }.allSatisfy { workspace.all($0).isEmpty } && workspace.all("events").isEmpty }
    init(preview: Bool = false) {
        self.preview = preview
        directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent(preview ? "AscendPreview" : "Ascend", isDirectory: true)
        if let url = Bundle.main.url(forResource: "calendar", withExtension: "js"), let script = try? String(contentsOf: url, encoding: .utf8) { calendar = try? CalendarEngine(script: script) } else { calendar = nil }
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            if preview {
                workspace = Demo.workspace
                let arguments = ProcessInfo.processInfo.arguments
                if arguments.contains("--monochrome") { var p = workspace.profile; p.set("theme", "monochrome"); workspace.profile = p }
                if arguments.contains("--dark") { var p = workspace.profile; p.set("theme", "dark"); workspace.profile = p }
                return
            }
            if FileManager.default.fileExists(atPath: file.path) {
                let bytes = try Data(contentsOf: file); originalData = bytes
                workspace = try Workspace.decode(bytes)
                originalData = nil
            }
        } catch { recoveryRequired = true; self.error = "Your saved file could not be opened. It has been preserved. Export the recovery file in Backup & transfer before importing a backup. \(error.localizedDescription)" }
    }
    @discardableResult func change(_ mutation: (inout Workspace) throws -> Void) -> Bool {
        guard !recoveryRequired else { error = "Recover or import a backup before editing. Your original file is preserved."; return false }
        do { var next = workspace; try mutation(&next); try commit(next); return true } catch { self.error = error.localizedDescription; return false }
    }
    private func commit(_ next: Workspace) throws {
        try next.validate()
        let bytes = try next.encoded()
        if !preview { try bytes.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }
        workspace = next; lastSaved = Date()
    }
    func replace(with next: Workspace) throws {
        try next.validate()
        if FileManager.default.fileExists(atPath: file.path), !preview {
            let recovery = directory.appendingPathComponent("before-last-import.json")
            try Data(contentsOf: file).write(to: recovery, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        try commit(next); recoveryRequired = false; originalData = nil
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "lastImport")
    }
    @discardableResult func save(_ collection: String, _ entry: Entry) -> Bool { change { $0.upsert(collection, entry) } }
    func archive(_ collection: String, _ id: String) { change { w in guard var e = w.entry(collection, id) else { return }; e.set("archived", true); w.upsert(collection, e) } }
    func toggleTask(_ id: String) { change { $0.toggleTask(id) } }
    func toggleRequirement(_ app: String, _ id: String) { change { try $0.toggleRequirement(appID: app, requirementID: id) } }
    func agenda(from: String, to: String) -> (items: [AgendaItem], warnings: [String]) { workspace.agenda(from: from, to: to, engine: calendar) }
    func dayNote(_ date: String, body: String) -> Bool {
        change { w in var e = w.all("dayNotes").first { $0.text("date") == date } ?? .new(); e.set("date", date); e.set("body", body); w.upsert("dayNotes", e) }
    }
}

struct TransferFile: FileDocument {
    static var readableContentTypes: [UTType] { [.json, .data, .calendarEvent, .plainText] }
    var data: Data
    init(_ data: Data = Data()) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}

enum Demo {
    /// Synthetic records for CI screenshots only. Never used for a normal app launch.
    static var workspace: Workspace {
        var w = Workspace.empty
        var p = w.profile; p.set("name", "Alex"); p.set("major", "Engineering"); p.set("onboarded", true); w.profile = p
        for (i, pair) in [("Cornell University", "190415"), ("Princeton University", "186131"), ("Stanford University", "243744")].enumerated() {
            var a = Entry.new(); a.set("name", pair.0); a.set("collegeId", pair.1); a.set("major", "Engineering"); a.set("status", i == 0 ? "Submitted" : "In Progress"); a.set("round", "Regular Decision"); a.set("deadline", DateKey.adding(12 + i * 3, to: DateKey.today)); a.set("timezone", "America/New_York"); a.set("url", "https://www.cornell.edu/")
            a.set("requirements", entries: ["Application", "Writing supplement", "School report", "Recommendations"].enumerated().map { j, title in var r = Entry.new(title: title); r.set("done", j < 2); r.set("required", true); r.set("weight", 1.0); return r }); a.set("statusHistory", entries: [])
            w.upsert("applications", a)
            var t = Entry.new(title: i == 0 ? "Activate your applicant portal" : i == 1 ? "Review your writing supplement" : "Request a teacher recommendation"); t.set("applicationId", a.id); t.set("category", i == 0 ? "Portal setup" : "Application"); t.set("due", DateKey.today); t.set("priority", i == 0 ? "High" : "Medium"); t.set("status", "To do"); t.set("recurrence", "Never"); t.set("notes", "Review the instructions and update your checklist when complete."); t.set("subtasks", entries: []); w.upsert("tasks", t)
        }
        var e = Entry.new(title: "Volleyball game"); e.set("date", DateKey.today); e.set("endDate", DateKey.today); e.set("time", "17:00"); e.set("endTime", "18:30"); e.set("allDay", false); e.set("category", "Sports"); e.set("timezone", TimeZone.current.identifier); e.set("repeat", "Weekly"); e.set("repeatInterval", 1.0); e.set("status", "Planned"); e.set("location", "School gym"); w.upsert("events", e)
        var n = Entry.new(title: "A few ideas for my personal statement"); n.set("body", "Start with a small moment. Show what changed, and why it mattered."); n.set("tags", "Writing"); w.upsert("notes", n)
        var essay = Entry.new(title: "Personal statement"); essay.set("body", "The first time I built something that worked, I wanted to understand why. That curiosity has followed me into every classroom, project, and conversation since."); essay.set("versions", entries: []); w.upsert("essays", essay)
        return w
    }
}
