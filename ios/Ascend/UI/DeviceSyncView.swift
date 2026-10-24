import SwiftUI
import UniformTypeIdentifiers

struct DeviceSyncView: View {
    @EnvironmentObject var store: WorkspaceStore
    @EnvironmentObject var sync: DeviceSyncStore
    @Environment(\.ascendColors) private var colors
    @State private var owner="YoussefElb-Dev"
    @State private var repo="ascend-private-sync"
    @State private var token=""
    @State private var key=""
    @State private var importing=false
    @State private var exporting=false
    @State private var document=TransferFile()
    @State private var filename="ascend-private-device-connection"
    @State private var confirm=""
    var body: some View {
        ZStack { PageBackground(); Form {
            Section("Connection") {
                Label(sync.status,systemImage:sync.busy ? "arrow.triangle.2.circlepath":"lock.shield").font(.appHeadline)
                if let c=sync.connection {
                    Text(c.owner+"/"+c.repo).font(.appCaption).foregroundStyle(colors.muted)
                    if let date=c.lastSync {Text("Last synced "+date).font(.appMicro).foregroundStyle(colors.muted)}
                    Button("Sync now") {Task{await sync.sync()}}.disabled(sync.busy)
                    Button("Export connection for another device") {exportConnection(c)}.disabled(sync.busy)
                    Button("Disconnect this iPhone",role:.destructive) {do{try sync.disconnect()}catch{store.error=error.localizedDescription}}.disabled(sync.busy)
                } else {
                    TextField("GitHub owner",text:$owner).textInputAutocapitalization(.never).autocorrectionDisabled()
                    TextField("Private repository",text:$repo).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Fine-grained GitHub token",text:$token).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Original sync key (or generate on first device)",text:$key).textInputAutocapitalization(.never).autocorrectionDisabled()
                    Button("Generate first-device key") {key=SyncCrypto.newKey()}
                    Button("Connect private sync") {Task{do{try await sync.connect(SyncConnection(owner:owner.trimmingCharacters(in:.whitespaces),repo:repo.trimmingCharacters(in:.whitespaces),token:token.trimmingCharacters(in:.whitespaces),key:key.trimmingCharacters(in:.whitespaces)));token="";key=""}catch{store.error=error.localizedDescription}}}.disabled(sync.busy||token.isEmpty||key.isEmpty)
                }
                Button("Import website device connection") {importing=true}.disabled(sync.busy)
            }
            if let conflict=sync.conflict {
                Section("Both copies have changes") {
                    Text("Choose the complete workspace to keep. Save both backups first if each copy has changes you need.").font(.appBody)
                    Text("This iPhone: \(store.workspace.all("applications").count) applications, \(store.workspace.all("tasks").count) tasks").font(.appCaption)
                    Text("Cloud: \(conflict.remote.workspace.all("applications").count) applications, \(conflict.remote.workspace.all("tasks").count) tasks").font(.appCaption)
                    Button("Export this iPhone before replacing") {exportWorkspace(store.workspace,name:"ascend-iphone-before-sync")}
                    Button("Export cloud workspace") {exportWorkspace(conflict.remote.workspace,name:"ascend-cloud-before-sync")}
                    Button("Use website / cloud workspace") {confirm="pull"}.disabled(sync.busy)
                    Button("Replace cloud with this iPhone",role:.destructive) {confirm="push"}.disabled(sync.busy)
                }
            }
            Section("How sync works") {
                Text("Saved edits sync after about 15 seconds, with checks roughly once a minute while the app is active. iOS does not guarantee closed-app background syncing. Changes on both devices pause for review; neither copy is silently replaced.").font(.appCaption).foregroundStyle(colors.muted)
                Text("Your full workspace, including documents, is encrypted on this device before upload. A random AES-256-GCM key protects the file in your private GitHub repository. The token and key are stored in iOS Keychain and excluded from normal workspace backups.").font(.appCaption).foregroundStyle(colors.muted)
                Text("A device connection file contains the token and encryption key. Transfer it privately, then remove extra copies. Keep the original key; a new key cannot decrypt the existing file.").font(.appCaption).foregroundStyle(colors.muted)
            }
            Section("One-time setup") {
                Text("On the website, open Device sync, create a fine-grained GitHub token for only ascend-private-sync with Contents read/write access, and connect. Export that connection and import it here. Choose the website/cloud workspace once if this is a new iPhone.").font(.appBody)
                SafeLink(title:"Open Ascend device sync",address:"https://ascend-college-planner.vercel.app/#sync")
                SafeLink(title:"GitHub token setup",address:"https://github.com/settings/personal-access-tokens/new")
            }
        }.scrollContentBackground(.hidden) }.navigationTitle("Device sync").navigationBarTitleDisplayMode(.inline)
            .fileImporter(isPresented:$importing,allowedContentTypes:[.json]) { result in
                do{let url=try result.get();let granted=url.startAccessingSecurityScopedResource();defer{if granted{url.stopAccessingSecurityScopedResource()}};guard (try url.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0)<16000 else{throw WorkspaceError.invalid("Choose a small device connection file.")};let c=try JSONDecoder().decode(SyncConnection.self,from:Data(contentsOf:url));guard c.format=="ascend-sync-connection-v1" else{throw WorkspaceError.invalid("This is not a device connection file.")};Task{do{try await sync.connect(c)}catch{store.error=error.localizedDescription}}}catch{store.error=error.localizedDescription}
            }
            .fileExporter(isPresented:$exporting,document:document,contentType:.json,defaultFilename:filename){result in if case .failure(let error)=result{store.error=error.localizedDescription}}
            .confirmationDialog("Replace the complete workspace?",isPresented:Binding(get:{!confirm.isEmpty},set:{if !$0{confirm=""}}),titleVisibility:.visible){Button("Confirm replacement",role:.destructive){let mode=confirm;confirm="";Task{await sync.sync(force:mode)}};Button("Cancel",role:.cancel){confirm=""}}message:{Text(confirm=="pull" ? "This iPhone will use the reviewed cloud copy. Its previous workspace is kept as a recovery file.":"The encrypted cloud file will be replaced with this iPhone’s current workspace.")}
    }
    private func exportConnection(_ c: SyncConnection){do{document=TransferFile(try JSONEncoder().encode(c.portable));filename="ascend-private-device-connection";exporting=true}catch{store.error=error.localizedDescription}}
    private func exportWorkspace(_ w: Workspace,name:String){do{document=TransferFile(try w.encoded(exported:true));filename=name;exporting=true}catch{store.error=error.localizedDescription}}
}

struct WorkspaceSearchView: View {
    @EnvironmentObject var store: WorkspaceStore
    @State private var query=""
    private var hits: [(String,Entry)] { let q=query.trimmingCharacters(in:.whitespacesAndNewlines);guard !q.isEmpty else{return []};return (["applications"]+RecordSpec.collections.map(\.0)).flatMap { key in store.workspace.records(key).filter { ($0.title+" "+$0.text("notes")+" "+$0.text("body")).localizedCaseInsensitiveContains(q) }.map{(key,$0)} } }
    var body: some View {
        Page {
            Text("Search applications, tasks, essays, notes, schoolwork, and the studio tools.").font(.appCaption)
            ForEach(Array(hits.prefix(100).enumerated()),id:\.offset) { _,hit in
                NavigationLink { if hit.0=="applications" {ApplicationDetail(id:hit.1.id)} else if hit.0=="documents" {DocumentsView()} else {RecordDetail(collection:hit.0,id:hit.1.id)} } label:{Panel{Text(hit.1.title).font(.appHeadline);Text(RecordSpec.title(hit.0)).font(.appCaption)}}.buttonStyle(.plain)
            }
            if !query.isEmpty&&hits.isEmpty{Text("No matching records.").font(.appBody)}
        }.navigationTitle("Search workspace").navigationBarTitleDisplayMode(.inline).searchable(text:$query,prompt:"Search your records")
    }
}
