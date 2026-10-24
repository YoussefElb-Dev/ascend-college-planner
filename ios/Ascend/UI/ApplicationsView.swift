import SwiftUI

struct ApplicationsView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var mode = "My colleges"
    @State private var search = ""
    @State private var status = "All"
    @State private var archived = false
    @State private var edit: EditTarget?
    var body: some View {
        Page {
            Picker("Colleges", selection: $mode) { Text("My colleges").tag("My colleges"); Text("Explore").tag("Explore") }.pickerStyle(.segmented)
            if mode == "Explore" { DirectoryView(search: search) }
            else {
                HStack {
                    SectionHeading(title: "Your next chapter", subtitle: "Every application, one clear view.")
                    Spacer()
                    Menu { Picker("Status", selection: $status) { Text("All").tag("All"); ForEach(AppOptions.statuses, id: \.self) { Text($0).tag($0) } }; Toggle("Show archived", isOn: $archived) } label: { Image(systemName: "line.3.horizontal.decrease").padding(12).glassPanel(30) }.accessibilityLabel("Filter colleges")
                }
                if status != "All" { StatusPill(text: status) }
                let items = store.workspace.records("applications", archived: archived).filter { (search.isEmpty || $0.title.localizedCaseInsensitiveContains(search)) && (status == "All" || $0.text("status") == status) }
                if items.isEmpty { EmptyCard(icon: "building.columns", title: "A fresh start", message: "Import your website backup or explore the college directory to add your schools.") }
                ForEach(items) { a in NavigationLink { ApplicationDetail(id: a.id) } label: { ApplicationCard(app: a) }.buttonStyle(.plain) }
                NavigationLink { ComparisonView() } label: { Label("Compare saved colleges", systemImage: "rectangle.split.2x1").font(.appBody.weight(.semibold)) }
            }
        }.navigationTitle("Colleges").navigationBarTitleDisplayMode(.inline).searchable(text: $search, prompt: "Search colleges")
            .toolbar { Button { edit = EditTarget("applications") } label: { Image(systemName: "plus") }.accessibilityLabel("Add application") }
            .sheet(item: $edit) { EntryEditor($0) }
    }
}

struct ApplicationDetail: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    var id: String
    @State private var edit: EditTarget?
    @State private var requirementTitle = ""
    @State private var requirementDependency = ""
    @State private var requirementOptional = false
    @State private var showRequirement = false
    private var app: Entry { store.workspace.entry("applications", id) ?? Entry() }
    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 8) {
                StatusPill(text: app.text("status"))
                Text(app.title).font(.appTitle.weight(.semibold)).tracking(-0.8)
                if !app.text("major").isEmpty { Text(app.text("major")).font(.appBody).foregroundStyle(colors.muted) }
                if !app.text("round").isEmpty { Text(app.text("round")).font(.appCaption).foregroundStyle(colors.muted) }
            }
            HStack {
                VStack(alignment: .leading, spacing: 6) { Text("DEADLINE").font(.appMicro.weight(.semibold)).tracking(1); Text(app.text("deadline").isEmpty ? "Not yet verified" : DateKey.label(app.text("deadline"))).font(.appHeadline); if !app.text("deadlineTime").isEmpty { Text(app.text("deadlineTime") + " " + app.text("timezone")).font(.appCaption).foregroundStyle(colors.muted) } }
                Spacer()
                SafeLink(title: "Open portal", address: app.text("url"))
            }.padding(14).glassPanel()
            Panel {
                HStack { SectionHeading(title: "Your checklist"); Spacer(); Text("\(Int(Workspace.progress(app) * 100))%").font(.appHeadline).monospacedDigit() }
                ProgressView(value: Workspace.progress(app))
                if app.entries("requirements").isEmpty { Text("Add the requirements listed in your college portal.").font(.appBody).foregroundStyle(colors.muted) }
                ForEach(app.entries("requirements")) { req in
                    HStack(alignment: .top, spacing: 4) {
                        CheckButton(done: req.flag("done") || req.flag("exempt"), label: req.title) { store.toggleRequirement(id, req.id) }.disabled(req.flag("exempt"))
                        VStack(alignment: .leading, spacing: 5) {
                            Text(req.title).font(.appBody.weight(.medium)).strikethrough(req.flag("done")).padding(.top, 11)
                            if req.flag("exempt") { Text("Exempt").font(.appCaption).foregroundStyle(colors.muted) }
                            else if req.fields["required"] == .bool(false) { Text("Optional").font(.appCaption).foregroundStyle(colors.muted) }
                            if let parent = app.entries("requirements").first(where: { $0.id == req.text("dependsOn") }) { Text("After: " + parent.title).font(.appCaption).foregroundStyle(colors.muted) }
                        }.frame(maxWidth: .infinity, alignment: .leading)
                        Menu {
                            Button(req.fields["required"] == .bool(false) ? "Make required" : "Make optional") { updateRequirement(req.id, field: "required", value: req.fields["required"] == .bool(false)) }
                            Button(req.flag("exempt") ? "Remove exemption" : "Mark exempt") { updateRequirement(req.id, field: "exempt", value: !req.flag("exempt")) }
                        } label: { Image(systemName: "ellipsis").frame(width: 30, height: 44) }.accessibilityLabel("Options for " + req.title)
                    }
                }
                Button { showRequirement = true } label: { Label("Add requirement", systemImage: "plus") }.font(.appBody.weight(.medium))
            }
            let linkedTasks = store.workspace.records("tasks").filter { $0.text("applicationId") == id }
            if !linkedTasks.isEmpty { Panel { SectionHeading(title: "Tasks & portal setup"); ForEach(linkedTasks) { RecordRow(entry: $0, collection: "tasks") } } }
            if !app.text("notes").isEmpty { Panel { SectionHeading(title: "Application notes"); Text(app.text("notes")).font(.appBody).textSelection(.enabled) } }
            ForEach(["aid", "essays", "notes", "recommendations", "offers"], id: \.self) { key in
                let linked = store.workspace.records(key).filter { $0.text("applicationId") == id }
                if !linked.isEmpty { Panel { SectionHeading(title: RecordSpec.title(key)); ForEach(linked) { RecordRow(entry: $0, collection: key) } } }
            }
            if let college = CollegeDirectory.shared.record(app.text("collegeId"), workspace: store.workspace) { NavigationLink { CollegeDetail(college: college) } label: { Label("College profile & tuition", systemImage: "building.columns").font(.appBody.weight(.semibold)) } }
            Button { var t = RecordSpec.new("tasks"); t.set("applicationId", id); edit = EditTarget("tasks", t) } label: { Label("Add a task for this college", systemImage: "plus") }.buttonStyle(.bordered).buttonBorderShape(.capsule)
            Button(app.flag("archived") ? "Restore application" : "Archive application", role: app.flag("archived") ? nil : .destructive) { var a = app; a.set("archived", !a.flag("archived")); store.save("applications", a) }.font(.appBody)
        }.navigationTitle("Application").navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Edit") { edit = EditTarget("applications", app) } }
            .sheet(item: $edit) { EntryEditor($0) }
            .sheet(isPresented: $showRequirement) { requirementSheet }
    }
    private func updateRequirement(_ reqID: String, field: String, value: Bool) {
        var a = app; a.set("requirements", entries: a.entries("requirements").map { r in var q = r; if q.id == reqID { q.set(field, value) }; return q }); store.save("applications", a)
    }
    private var requirementSheet: some View {
        NavigationStack { Form { TextField("Requirement title", text: $requirementTitle); Toggle("Optional", isOn: $requirementOptional); Picker("Prerequisite", selection: $requirementDependency) { Text("None").tag(""); ForEach(app.entries("requirements")) { Text($0.title).tag($0.id) } } }.navigationTitle("Add requirement").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showRequirement = false } }; ToolbarItem(placement: .confirmationAction) { Button("Add") { var a = app; var r = Entry.new(title: requirementTitle.trimmingCharacters(in: .whitespacesAndNewlines)); r.set("done", false); r.set("required", !requirementOptional); r.set("exempt", false); r.set("weight", 1.0); r.set("dependsOn", requirementDependency); a.set("requirements", entries: a.entries("requirements") + [r]); if store.save("applications", a) { requirementTitle = ""; requirementDependency = ""; requirementOptional = false; showRequirement = false } }.disabled(requirementTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) } } }
    }
}
