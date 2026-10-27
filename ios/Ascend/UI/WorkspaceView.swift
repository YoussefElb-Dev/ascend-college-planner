import SwiftUI
import UniformTypeIdentifiers
import QuickLook

struct WorkspaceView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    var body: some View {
        ZStack { PageBackground(); List {
            Section { NavigationLink { TransferView() } label: { Label("Backup & transfer", systemImage: "arrow.triangle.2.circlepath") }; NavigationLink { ProfileView() } label: { Label("Profile & appearance", systemImage: "slider.horizontal.3") } }
            Section("Studio & planning") { NavigationLink { WorkspaceSearchView() } label: { Label("Search workspace",systemImage:"magnifyingglass") }; NavigationLink { StudioView() } label: { Label("Studio & tools",systemImage:"sparkles") }; NavigationLink { DeviceSyncView() } label: { Label("Device sync",systemImage:"arrow.triangle.2.circlepath") } }
            Section("Your workspace") {
                ForEach(RecordSpec.collections, id: \.0) { key, title, icon in
                    NavigationLink { if key == "documents" { DocumentsView() } else { RecordList(collection: key) } } label: { HStack(spacing: 10) { Image(systemName: icon).foregroundStyle(colors.accent).frame(width: 25); Text(title); Spacer(); Text("\(store.workspace.records(key).count)").font(.appBody).foregroundStyle(colors.muted) } }.padding(.vertical, 2)
                }
                NavigationLink { QuestBridgeView() } label: { Label("QuestBridge", systemImage: "point.topleft.down.to.point.bottomright.curvepath") }
            }
            Section { Text("Local by design. Complete workspace backups stay compatible with your Ascend website. Optional GitHub sync stores an encrypted copy in your private repository. Campus images use public Wikimedia sources; your private workspace is never sent to those services.").font(.appCaption).foregroundStyle(colors.muted) }
        }.scrollContentBackground(.hidden) }.navigationTitle("Workspace").navigationBarTitleDisplayMode(.inline)
    }
}

struct ProfileView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var profile = Entry()
    @State private var loaded = false
    @State private var saved = false
    private func binding(_ field: String) -> Binding<String> { Binding(get: { profile.text(field) }, set: { profile.set(field, $0); saved = false }) }
    var body: some View {
        Form {
            Section("About you") { TextField("Name", text: binding("name")); TextField("Graduation year", text: binding("graduation")).keyboardType(.numberPad); TextField("Intended major", text: binding("major")); TextField("High school", text: binding("highSchool")); TextField("State", text: binding("state")); TextField("Application stage", text: binding("stage")) }
            Section("Appearance") { Picker("Theme", selection: binding("theme")) { Text("Classic · white & cobalt").tag("light"); Text("Dark").tag("dark"); Text("Black & white").tag("monochrome"); Text("Follow iPhone").tag("system") }; Text("The same white, navy, and cobalt palette as the website, with compact cards and Plus Jakarta Sans. Black & white also removes color from photos.").font(.appCaption).foregroundStyle(colors.muted) }
            Section { Toggle("QuestBridge planning", isOn: Binding(get: { profile.flag("questbridge") }, set: { profile.set("questbridge", $0); saved = false })); Button(saved ? "Saved" : "Save profile") { if store.change({ $0.profile = profile }) { saved = true } }.fontWeight(.semibold) }
            Section { NavigationLink("Backup & transfer") { TransferView() }; NavigationLink("Open-source licenses") { LicenseView() }; LabeledContent("Version", value: "1.2 (3)"); Text("Ascend is a personal planning tool. The app does not sign into portals or submit applications.").font(.appCaption).foregroundStyle(colors.muted) }
        }.navigationTitle("Profile & appearance").navigationBarTitleDisplayMode(.inline).onAppear { if !loaded { profile = store.workspace.profile; loaded = true } }
    }
}

private struct LicenseView: View {
    @Environment(\.ascendColors) private var colors
    private var license: String { guard let url = Bundle.main.url(forResource: "ical-LICENSE", withExtension: "txt") else { return "Mozilla Public License 2.0 · https://mozilla.org/MPL/2.0/" }; return (try? String(contentsOf: url, encoding: .utf8)) ?? "" }
    private var fontLicense: String { guard let url = Bundle.main.url(forResource: "plus-jakarta-sans-OFL", withExtension: "txt") else { return "SIL Open Font License 1.1" }; return (try? String(contentsOf: url, encoding: .utf8)) ?? "" }
    var body: some View { Page { DisclosureGroup("Plus Jakarta Sans · SIL OFL 1.1") { Text(fontLicense).font(.appCaption).textSelection(.enabled) }; Text("ical.js 2.2.1").font(.appHeadline); Text("Calendar parsing and recurrence run locally in JavaScriptCore. Source is bundled in calendar.js, with Ascend’s calendar adapter. Portions copyright Philipp Kewisch.").font(.appBody); SafeLink(title: "Original ical.js source", address: "https://github.com/kewisch/ical.js"); DisclosureGroup("Mozilla Public License 2.0") { Text(license).font(.appCaption).textSelection(.enabled) } }.navigationTitle("Open-source licenses").navigationBarTitleDisplayMode(.inline) }
}

struct QuestBridgeView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var status = ""
    @State private var outcome = ""
    private var ranking: [String] { store.workspace.root["questbridge"]?.object["ranking"]?.array.map(\.text) ?? [] }
    var body: some View {
        Form {
            Section("QuestBridge") { TextField("Status", text: $status); TextField("Outcome", text: $outcome); Button("Save") { store.change { w in var qb = w.root["questbridge"]?.object ?? [:]; qb["status"] = .string(status); qb["outcome"] = .string(outcome); qb["ranking"] = qb["ranking"] ?? .array([]); w.root["questbridge"] = .object(qb) } } }
            Section("Your ranking") {
                ForEach(Array(ranking.enumerated()), id: \.offset) { index, id in HStack { Text("\(index + 1)").font(.appCaption.weight(.semibold)).foregroundStyle(colors.muted).frame(width: 25); Text(store.workspace.entry("applications", id)?.title ?? CollegeDirectory.shared.record(id, workspace: store.workspace)?.title ?? id) } }
                    .onMove { indices, offset in store.change { w in var list = ranking; list.move(fromOffsets: indices, toOffset: offset); var qb = w.root["questbridge"]?.object ?? [:]; qb["ranking"] = .array(list.map(JSONValue.string)); w.root["questbridge"] = .object(qb) } }
                    .onDelete { indices in store.change { w in var list = ranking; list.remove(atOffsets: indices); var qb = w.root["questbridge"]?.object ?? [:]; qb["ranking"] = .array(list.map(JSONValue.string)); w.root["questbridge"] = .object(qb) } }
                Menu("Add a college") { ForEach(store.workspace.records("applications").filter { !ranking.contains($0.id) }) { a in Button(a.title) { store.change { w in var qb = w.root["questbridge"]?.object ?? [:]; qb["ranking"] = .array((ranking + [a.id]).map(JSONValue.string)); w.root["questbridge"] = .object(qb) } } } }
            }
            Section { Text("This is your planning list. Make official changes in QuestBridge by its published deadlines.").font(.appCaption).foregroundStyle(colors.muted) }
        }.navigationTitle("QuestBridge").toolbar { EditButton() }.onAppear { status = store.workspace.root["questbridge"]?.object["status"]?.text ?? ""; outcome = store.workspace.root["questbridge"]?.object["outcome"]?.text ?? "" }
    }
}

struct DocumentsView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var importing = false
    @State private var archived = false
    @State private var previewURL: URL?
    var body: some View {
        ZStack { PageBackground(); List {
            Section { Text("Documents are included in full workspace backups. Up to 1 MB per file and 3 MB total for new uploads.").font(.appCaption).foregroundStyle(colors.muted); Toggle("Show archived", isOn: $archived) }
            ForEach(store.workspace.records("documents", archived: archived)) { document in
                VStack(alignment: .leading, spacing: 8) {
                    Button { open(document) } label: { Label(document.title, systemImage: "doc").font(.appBody.weight(.medium)) }
                    Text(ByteCountFormatter.string(fromByteCount: Int64(document.number("size")), countStyle: .file)).font(.appCaption).foregroundStyle(colors.muted)
                    HStack { if let url = fileURL(document) { ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") } }; Spacer(); Button(archived ? "Restore" : "Archive") { var e = document; e.set("archived", !archived); store.save("documents", e) } }.font(.appCaption)
                }.padding(.vertical, 8)
            }
        }.scrollContentBackground(.hidden) }.navigationTitle("Documents").toolbar { Button { importing = true } label: { Image(systemName: "plus") }.accessibilityLabel("Add document") }.quickLookPreview($previewURL)
            .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .plainText, .png, .jpeg, .gif, UTType(filenameExtension: "webp") ?? .image, UTType(filenameExtension: "docx") ?? .data], allowsMultipleSelection: false) { result in
                do {
                    guard let url = try result.get().first else { return }; let scope = url.startAccessingSecurityScopedResource(); defer { if scope { url.stopAccessingSecurityScopedResource() } }
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0; guard size <= 1024 * 1024 else { throw WorkspaceError.invalid("Choose a document smaller than 1 MB.") }
                    let data = try Data(contentsOf: url); let total = store.workspace.all("documents").reduce(0) { $0 + Int($1.number("size")) }
                    guard total + data.count <= 3 * 1024 * 1024 else { throw WorkspaceError.invalid("Documents exceed the 3 MB workspace limit.") }
                    let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                    var e = Entry.new(); e.fields.removeValue(forKey: "title"); e.set("name", url.lastPathComponent); e.set("type", mime); e.set("size", Double(data.count)); e.set("data", "data:" + mime + ";base64," + data.base64EncodedString()); try Workspace.validateDocument(e); store.save("documents", e)
                } catch { store.error = error.localizedDescription }
            }
    }
    private func fileURL(_ e: Entry) -> URL? {
        let parts = e.text("data").components(separatedBy: ";base64,"); guard parts.count == 2, let bytes = Data(base64Encoded: parts[1]) else { return nil }
        let safeName = URL(fileURLWithPath: e.title).lastPathComponent
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("AscendDocuments", isDirectory: true)
        do { try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true); let url = folder.appendingPathComponent(e.id + "-" + safeName); if !FileManager.default.fileExists(atPath: url.path) { try bytes.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]) }; return url } catch { return nil }
    }
    private func open(_ e: Entry) { if let url = fileURL(e) { previewURL = url } else { store.error = "This document could not be opened." } }
}
