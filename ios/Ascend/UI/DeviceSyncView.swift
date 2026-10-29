import SwiftUI
import UniformTypeIdentifiers
import AuthenticationServices

struct DeviceSyncView: View {
    @EnvironmentObject var store: WorkspaceStore
    @EnvironmentObject var sync: DeviceSyncStore
    @Environment(\.ascendColors) private var colors
    @StateObject private var account = AccountSignIn()
    @State private var exporting = false
    @State private var document = TransferFile()
    @State private var filename = "ascend-backup"
    @State private var confirm = ""
    var body: some View {
        Page {
            SectionHeading(title: "Your workspace, everywhere", subtitle: "Connect once. Your plans stay together across the website and iPhone.")
            Panel {
                Label(sync.status, systemImage: sync.busy ? "arrow.triangle.2.circlepath" : "checkmark.icloud").font(.appHeadline)
                if let connection = sync.connection {
                    Text("Your private workspace is connected. Changes sync automatically while Ascend is open.").font(.appBody).foregroundStyle(colors.muted)
                    if let last = connection.lastSync { Text("Last synced " + last).font(.appMicro).foregroundStyle(colors.muted) }
                    Button("Sync now") { Task { await sync.sync() } }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).disabled(sync.busy)
                    Button("Disconnect this iPhone", role: .destructive) { do { try sync.disconnect() } catch { store.error = error.localizedDescription } }.font(.appCaption).disabled(sync.busy)
                } else {
                    Text("Sign in with the GitHub account you use on the website. Your saved workspace restores automatically on a new iPhone.").font(.appBody).foregroundStyle(colors.muted)
                    Button { Task { do { try await account.connect(to: sync) } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin { } catch { store.error = error.localizedDescription } } } label: { Label(account.busy ? "Connecting…" : "Sign in with GitHub", systemImage: "person.crop.circle.badge.checkmark") }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).disabled(account.busy || sync.busy)
                }
            }
            if let conflict = sync.conflict {
                Panel {
                    SectionHeading(title: "Both copies have changes", subtitle: "Choose the workspace to keep. Save backups first if each copy has changes you need.")
                    Text("This iPhone: \(store.workspace.all("applications").count) applications · \(store.workspace.all("tasks").count) tasks").font(.appCaption)
                    Text("Cloud: \(conflict.remote.workspace.all("applications").count) applications · \(conflict.remote.workspace.all("tasks").count) tasks").font(.appCaption)
                    Button("Save this iPhone backup") { exportWorkspace(store.workspace, name: "ascend-iphone-before-sync") }
                    Button("Save cloud backup") { exportWorkspace(conflict.remote.workspace, name: "ascend-cloud-before-sync") }
                    Button("Use website / cloud workspace") { confirm = "pull" }.disabled(sync.busy)
                    Button("Replace cloud with this iPhone", role: .destructive) { confirm = "push" }.disabled(sync.busy)
                }
            }
            Panel {
                SectionHeading(title: "Always your workspace")
                Text("Edits sync after about 15 seconds, with checks roughly once a minute while the app is active. Offline changes stay saved here. Changes made independently on both devices pause for review.").font(.appCaption).foregroundStyle(colors.muted)
                Text("Your complete workspace is encrypted before it reaches your private GitHub repository. Your connection is protected in iOS Keychain. iOS does not guarantee sync while the app is closed.").font(.appCaption).foregroundStyle(colors.muted)
                SafeLink(title: "Open Ascend website", address: "https://ascend-college-planner.vercel.app")
            }
        }.navigationTitle("Device sync").navigationBarTitleDisplayMode(.inline)
            .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: filename) { result in if case .failure(let error) = result { store.error = error.localizedDescription } }
            .confirmationDialog("Replace the complete workspace?", isPresented: Binding(get: { !confirm.isEmpty }, set: { if !$0 { confirm = "" } }), titleVisibility: .visible) { Button("Confirm replacement", role: .destructive) { let mode = confirm; confirm = ""; Task { await sync.sync(force: mode) } }; Button("Cancel", role: .cancel) { confirm = "" } } message: { Text(confirm == "pull" ? "This iPhone will use the reviewed cloud copy. Its previous workspace is kept as a recovery file." : "The encrypted cloud file will be replaced with this iPhone’s current workspace.") }
    }
    private func exportWorkspace(_ workspace: Workspace, name: String) { do { document = TransferFile(try workspace.encoded(exported: true)); filename = name; exporting = true } catch { store.error = error.localizedDescription } }
}

struct WorkspaceSearchView: View {
    @EnvironmentObject var store: WorkspaceStore
    @State private var query = ""
    private var hits: [(String, Entry)] { let q = query.trimmingCharacters(in: .whitespacesAndNewlines); guard !q.isEmpty else { return [] }; return (["applications"] + RecordSpec.collections.map(\.0)).flatMap { key in store.workspace.records(key).filter { ($0.title + " " + $0.text("notes") + " " + $0.text("body")).localizedCaseInsensitiveContains(q) }.map { (key, $0) } } }
    var body: some View {
        Page {
            Panel { HStack { Image(systemName: "magnifyingglass"); TextField("Search your records", text: $query).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("workspaceSearch") } }
            Text("Search applications, tasks, essays, notes, schoolwork, and studio tools.").font(.appCaption)
            ForEach(Array(hits.prefix(100).enumerated()), id: \.offset) { _, hit in NavigationLink { if hit.0 == "applications" { ApplicationDetail(id: hit.1.id) } else if hit.0 == "documents" { DocumentsView() } else { RecordDetail(collection: hit.0, id: hit.1.id) } } label: { Panel { Text(hit.1.title).font(.appHeadline); Text(RecordSpec.title(hit.0)).font(.appCaption) } }.buttonStyle(.plain) }
            if !query.isEmpty && hits.isEmpty { Text("No matching records.").font(.appBody) }
        }.navigationTitle("Search workspace").navigationBarTitleDisplayMode(.inline).scrollDismissesKeyboard(.interactively)
    }
}
