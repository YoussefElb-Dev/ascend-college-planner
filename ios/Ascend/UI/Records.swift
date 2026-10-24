import SwiftUI

struct EditTarget: Identifiable {
    var collection: String
    var entry: Entry
    var id: String { collection + entry.id }
    init(_ collection: String, _ entry: Entry? = nil) { self.collection = collection; self.entry = entry ?? RecordSpec.new(collection) }
}

struct RecordField: Identifiable {
    var key: String; var label: String; var kind: Kind = .text
    var id: String { key }
    enum Kind { case text, paragraph, date, time, number, choices([String]) }
    init(_ key: String, _ label: String, _ kind: Kind = .text) { self.key = key; self.label = label; self.kind = kind }
}

enum RecordSpec {
    static let collections: [(String, String, String)] = [
        ("tasks", "Tasks & portal setup", "checklist"), ("essays", "Essays", "doc.text"), ("notes", "Notes", "note.text"),
        ("aid", "Financial aid", "banknote"), ("scholarships", "Scholarships", "graduationcap"), ("documents", "Documents", "folder"),
        ("recommendations", "Recommendations", "person.2"), ("activities", "Activities", "figure.run"), ("honors", "Honors & awards", "rosette"),
        ("tests", "Tests", "pencil.and.list.clipboard"), ("visits", "Visits & interviews", "map"), ("contacts", "Contacts", "person.crop.circle"),
        ("goals", "Goals", "target"), ("expenses", "Expenses", "creditcard"), ("offers", "Offers & decisions", "envelope.open")
    ] + ToolCatalog.definitions.map { ($0.text("key"),$0.title,$0.text("symbol")) }
    static func title(_ key: String) -> String { key == "applications" ? "Application" : key == "events" ? "Event" : collections.first { $0.0 == key }?.1 ?? key.capitalized }
    static func new(_ key: String) -> Entry {
        var e = Entry.new(); e.set("status", "Not Started")
        if key == "applications" { e.set("name", ""); e.fields.removeValue(forKey: "title"); e.set("status", "In Progress"); e.set("round", "Regular Decision"); e.set("requirements", entries: []); e.set("statusHistory", entries: []) }
        if key == "tasks" { e.set("status", "To do"); e.set("category", "Application"); e.set("priority", "Medium"); e.set("recurrence", "Never"); e.set("subtasks", entries: []) }
        if key == "essays" { e.set("body", ""); e.set("versions", entries: []) }
        if key == "events" { e.set("date", DateKey.today); e.set("endDate", DateKey.today); e.set("time", "09:00"); e.set("endTime", "10:00"); e.set("allDay", false); e.set("timezone", TimeZone.current.identifier); e.set("repeat", "None"); e.set("repeatInterval", 1.0); e.set("category", "Personal"); e.set("status", "Planned") }
        if key=="interviewPractice" {e.set("question",["Tell me about a time you changed your mind.","Why are you interested in this college?","Describe a challenge and the steps you took.","How have you contributed to a community?"].randomElement()!)}
        if let d=ToolCatalog.definitions.first(where:{$0.text("key")==key}) { if let f=d.entries("fields").first(where:{$0.text("key")=="status"}),let value=f.fields["values"]?.array.first {e.fields["status"]=value};if key=="habits"{e.fields["doneDates"] = .array([])} }
        return e
    }
    static func fields(_ key: String) -> [RecordField] {
        let due = RecordField("due", "Due date", .date), url = RecordField("url", "Link"), notes = RecordField("notes", "Notes", .paragraph)
        let category = RecordField("category", "Category"), organization = RecordField("organization", "Organization")
        let generalStatus = RecordField("status", "Status", .choices(["Not Started", "In Progress", "Submitted", "Complete", "Not applicable"]))
        switch key {
        case "applications": return [.init("major", "Major"), .init("status", "Status", .choices(AppOptions.statuses)), .init("round", "Round", .choices(AppOptions.rounds)), .init("pathway", "Pathway"), .init("deadline", "Deadline", .date), .init("deadlineTime", "Deadline time", .time), .init("timezone", "Time zone (IANA)"), url, notes]
        case "tasks": return [.init("category", "Category", .choices(["Portal setup", "Application", "Essay", "Financial aid", "Recommendation", "Testing", "Personal", "Other"])), .init("status", "Status", .choices(["To do", "In Progress", "Done"])), .init("priority", "Priority", .choices(["High", "Medium", "Low"])), due, .init("time", "Time", .time), .init("timezone", "Time zone (IANA)"), .init("recurrence", "Repeat", .choices(["Never", "Daily", "Weekly", "Monthly"])), notes]
        case "essays": return [.init("category", "Writing type"), .init("tags", "Tags"), .init("prompt", "Prompt", .paragraph), .init("body", "Draft", .paragraph), .init("limit", "Word limit", .number), .init("status", "Status", .choices(["Not Started", "Drafting", "Revising", "Complete"])), due, notes]
        case "notes": return [.init("tags", "Tags"), .init("body", "Note", .paragraph)]
        case "aid": return [category, .init("status", "Status", .choices(["Not verified", "Not Started", "In Progress", "Submitted", "Complete", "Not applicable"])), due, url, notes]
        case "scholarships": return [.init("amount", "Amount (USD)", .number), due, .init("status", "Status", .choices(["Researching", "Not Started", "In Progress", "Submitted", "Awarded", "Not Awarded"])), .init("verification", "Verification", .choices(["Not verified", "Verified by me"])), url, notes]
        case "recommendations": return [.init("role", "Recommender role"), .init("contact", "Email / contact"), .init("requested", "Requested on", .date), due, .init("status", "Status", .choices(["Not Requested", "Planning to Request", "Requested", "Recommender Confirmed", "Submitted", "Unable to Confirm"])), notes]
        case "activities": return [organization, category, .init("grades", "Grade levels"), .init("hours", "Hours per week", .number), .init("weeks", "Weeks per year", .number), .init("description", "Description", .paragraph)]
        case "honors": return [organization, .init("level", "Recognition level"), .init("grades", "Grade levels"), .init("description", "Description", .paragraph)]
        case "tests": return [.init("subject", "Subject"), due, .init("status", "Status", .choices(["Planning", "Registered", "Preparing", "Done", "Canceled"])), .init("score", "Score"), .init("target", "Target score"), notes]
        case "visits": return [category, due, .init("time", "Time", .time), .init("location", "Location"), .init("contact", "Contact"), .init("status", "Status", .choices(["Planning", "Booked", "Done", "Canceled"])), .init("questions", "Questions", .paragraph), .init("reflection", "Reflection", .paragraph), notes]
        case "contacts": return [.init("role", "Role"), organization, .init("email", "Email"), .init("phone", "Phone"), due, .init("status", "Status"), .init("history", "Contact history", .paragraph), notes]
        case "goals": return [due, .init("status", "Status", .choices(["To do", "In Progress", "Done"])), notes]
        case "expenses": return [category, .init("amount", "Amount (USD)", .number), due, .init("status", "Status", .choices(["Planned", "Paid", "Waived"])), notes]
        case "offers": return [.init("year", "Academic year"), .init("verification", "These figures are", .choices(["Estimate", "Confirmed offer"])), .init("cost", "Annual cost of attendance (USD)", .number), .init("grants", "Grants (USD)", .number), .init("scholarships", "Scholarships (USD)", .number), .init("loans", "Loans offered (USD)", .number), .init("workstudy", "Work-study offered (USD)", .number), notes]
        case "events": return [.init("date", "Starts on", .date), .init("endDate", "Ends on", .date), .init("time", "Start time", .time), .init("endTime", "End time", .time), .init("timezone", "Time zone (IANA)"), .init("category", "Category", .choices(["Personal", "Sports", "School", "Study", "Work", "Family", "Health", "Social", "Travel", "Other"])), .init("location", "Location"), .init("repeat", "Repeat", .choices(["None", "Daily", "Weekly", "Monthly", "Yearly"])), .init("repeatUntil", "Repeat until", .date), .init("status", "Status", .choices(["Planned", "Done", "Canceled"])), notes]
        default: return ToolCatalog.fields(key) ?? [generalStatus, due, url, notes]
        }
    }
}

struct EntryEditor: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.dismiss) private var dismiss
    var collection: String
    @State private var entry: Entry
    private let original: Entry
    init(_ target: EditTarget) { collection = target.collection; original = target.entry; _entry = State(initialValue: target.entry) }
    private var imported: Bool { collection == "events" && !entry.text("ical").isEmpty }
    private func binding(_ key: String) -> Binding<String> { Binding(get: { entry.text(key) }, set: { entry.set(key, $0) }) }
    var body: some View {
        NavigationStack {
            Form {
                if imported { Section { Label("This event came from a calendar file. Its recurrence and time zone are preserved. Update it in the source calendar, then import again.", systemImage: "calendar.badge.clock").font(.appBody) } }
                Section("Details") {
                    TextField(collection == "applications" ? "College name" : "Title", text: binding(collection == "applications" ? "name" : "title")).accessibilityIdentifier("recordTitle")
                    if collection != "applications" && collection != "events" {
                        Picker("College", selection: binding("applicationId")) { Text("None").tag(""); ForEach(store.workspace.records("applications")) { a in Text(a.title).tag(a.id) } }
                    }
                    if collection == "events" { Toggle("All day", isOn: Binding(get: { entry.flag("allDay") }, set: { entry.set("allDay", $0) })) }
                    ForEach(RecordSpec.fields(collection)) { field in fieldView(field) }
                }.disabled(imported)
                if collection == "essays" {
                    Section { Text("\(entry.text("body").split { $0.isWhitespace || $0.isNewline }.count) words · Each saved edit preserves the previous draft in version history.").font(.appCaption).foregroundStyle(colors.muted) }
                }
                if collection == "applications" { Section { Text("Add checklist requirements from the application’s detail screen. Leave dates empty until verified with the college.").font(.footnote).foregroundStyle(colors.muted) } }
            }.navigationTitle(imported ? "Calendar event" : "Edit " + (collection == "applications" ? "application" : collection == "events" ? "event" : "record")).navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).fontWeight(.semibold).disabled(entry.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || imported).accessibilityIdentifier("saveRecord") } }
        }
    }
    @ViewBuilder private func fieldView(_ f: RecordField) -> some View {
        switch f.kind {
        case .text: TextField(f.label, text: binding(f.key)).textInputAutocapitalization(["url", "email"].contains(f.key) ? .never : .sentences)
        case .number: TextField(f.label, text: binding(f.key)).keyboardType(.decimalPad)
        case .paragraph:
            VStack(alignment: .leading, spacing: 8) { Text(f.label).font(.appCaption).foregroundStyle(colors.muted); TextEditor(text: binding(f.key)).frame(minHeight: f.key == "body" ? 220 : 90).accessibilityLabel(f.label) }
        case .date: DateField(title: f.label, value: binding(f.key))
        case .time: if collection != "events" || !entry.flag("allDay") { TimeField(title: f.label, value: binding(f.key), required: collection == "events") }
        case .choices(let values):
            Picker(f.label, selection: binding(f.key)) {
                if !values.contains(entry.text(f.key)) { Text(entry.text(f.key).isEmpty ? "Choose…" : entry.text(f.key)).tag(entry.text(f.key)) }
                ForEach(values, id: \.self) { Text($0).tag($0) }
            }
        }
    }
    private func save() {
        for field in RecordSpec.fields(collection) {
            if case .number = field.kind, !entry.text(field.key).isEmpty {
                guard let number = Double(entry.text(field.key)), number.isFinite, number >= 0, number <= 10000000 else { store.error = "Enter a valid nonnegative number for \(field.label)."; return }
            }
        }
        var next = entry
        next.set("updated", Date().timeIntervalSince1970 * 1000)
        if collection == "essays", next.text("body") != original.text("body"), !original.text("body").isEmpty {
            var version = Entry.new(); version.set("body", original.text("body")); version.set("at", Date().timeIntervalSince1970 * 1000); next.set("versions", entries: original.entries("versions") + [version])
        }
        if collection == "applications", next.text("status") != original.text("status") {
            let history = Entry(["status": .string(next.text("status")), "at": .string(ISO8601DateFormatter().string(from: Date()))]); next.set("statusHistory", entries: original.entries("statusHistory") + [history])
        }
        if collection == "tasks", next.text("status") == "Done", original.text("status") != "Done" {
            next.set("status", original.text("status")); let final = next
            if store.change({ w in w.upsert(collection, final); w.toggleTask(final.id) }) { dismiss() }; return
        }
        if store.save(collection, next) { dismiss() }
    }
}

struct RecordRow: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    var entry: Entry
    var collection: String
    var body: some View {
        HStack(spacing: 2) {
            if collection == "tasks" { CheckButton(done: entry.text("status") == "Done", label: entry.title) { store.toggleTask(entry.id) } }
            NavigationLink { RecordDetail(collection: collection, id: entry.id) } label: {
                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.title).font(.appBody.weight(.medium)).foregroundStyle(colors.text).strikethrough(collection == "tasks" && entry.text("status") == "Done").fixedSize(horizontal: false, vertical: true)
                    let school = store.workspace.collegeName(for: entry)
                    if !school.isEmpty { Text(school).font(.appCaption).foregroundStyle(colors.muted) }
                    HStack { if !entry.text("due").isEmpty { Text(DateKey.label(entry.text("due"))).font(.appCaption).foregroundStyle(entry.text("due") < DateKey.today && entry.text("status") != "Done" ? .red : .secondary) }; if collection != "tasks" && !entry.text("status").isEmpty { Text(entry.text("status")).font(.appCaption).foregroundStyle(colors.muted) } }
                }.frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.appCaption.weight(.semibold)).foregroundStyle(.tertiary)
            }.buttonStyle(.plain).padding(.vertical, 5)
        }
    }
}

struct RecordList: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    var collection: String
    @State private var search = ""
    @State private var showArchived = false
    @State private var hideDone = true
    @State private var edit: EditTarget?
    private var items: [Entry] { store.workspace.records(collection, archived: showArchived).filter { (search.isEmpty || ($0.title + $0.text("notes") + store.workspace.collegeName(for: $0)).localizedCaseInsensitiveContains(search)) && (!hideDone || !["Done", "Complete"].contains($0.text("status"))) }.sorted { ($0.text("due").isEmpty ? "9999" : $0.text("due")) < ($1.text("due").isEmpty ? "9999" : $1.text("due")) } }
    var body: some View {
        ZStack {
            PageBackground()
            List {
                Section { Toggle("Hide completed", isOn: $hideDone); Toggle("Show archived", isOn: $showArchived) }
                if items.isEmpty { ContentUnavailableView("No records here", systemImage: "tray", description: Text("Add a record or adjust your filters.")) }
                ForEach(items) { entry in RecordRow(entry: entry, collection: collection) }
            }.scrollContentBackground(.hidden)
        }.navigationTitle(RecordSpec.title(collection)).navigationBarTitleDisplayMode(.inline).searchable(text: $search)
            .toolbar { Button { edit = EditTarget(collection) } label: { Image(systemName: "plus") }.accessibilityLabel("Add record") }
            .sheet(item: $edit) { EntryEditor($0) }
    }
}

struct RecordDetail: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    var collection: String
    var id: String
    @State private var edit: EditTarget?
    @State private var subtask = ""
    @State private var restoreVersion: Entry?
    private var entry: Entry { store.workspace.entry(collection, id) ?? Entry() }
    var body: some View {
        Page {
            SectionHeading(title: entry.title, subtitle: store.workspace.collegeName(for: entry))
            if !entry.text("status").isEmpty { StatusPill(text: entry.text("status")) }
            if collection == "tasks" {
                Button(entry.text("status") == "Done" ? "Reopen task" : "Mark complete") { store.toggleTask(id) }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent).buttonBorderShape(.capsule)
                Panel {
                    SectionHeading(title: "Steps", subtitle: entry.text("category"))
                    ForEach(entry.entries("subtasks")) { step in HStack { CheckButton(done: step.flag("done"), label: step.title) { toggleStep(step.id) }; Text(step.title).font(.appBody).strikethrough(step.flag("done")) } }
                    HStack { TextField("Add a step", text: $subtask); Button { addStep() } label: { Image(systemName: "plus.circle.fill").font(.appTitle) }.disabled(subtask.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty).accessibilityLabel("Add step") }
                }
            }
            Panel {
                ForEach(RecordSpec.fields(collection)) { f in
                    let text = entry.text(f.key)
                    if !text.isEmpty {
                        VStack(alignment: .leading, spacing: 6) { Text(f.label).font(.appCaption.weight(.medium)).foregroundStyle(colors.muted); if f.key == "url" { SafeLink(title: "Open link", address: text) } else { Text(text).font(.appBody).textSelection(.enabled).fixedSize(horizontal: false, vertical: true) } }
                    }
                }
            }
            if collection == "essays" && !entry.entries("versions").isEmpty {
                Panel { SectionHeading(title: "Version history"); ForEach(entry.entries("versions").reversed()) { v in
                    DisclosureGroup(Date(timeIntervalSince1970: v.number("at") / 1000).formatted(date: .abbreviated, time: .shortened)) { Text(v.text("body")).font(.appBody).textSelection(.enabled); Button("Restore this draft") { restoreVersion = v }.padding(.top, 8) }
                } }
            }
            if collection == "essays" { essayReview }
            if collection == "offers" {
                Panel { SectionHeading(title: "Your annual net cost", subtitle: entry.text("verification").isEmpty ? "Estimate" : entry.text("verification")); Text(entry.text("cost").isEmpty ? "Not recorded" : (entry.number("cost") - entry.number("grants") - entry.number("scholarships")).formatted(.currency(code: "USD"))).font(.appTitle.weight(.semibold)); Text("Cost of attendance minus grants and scholarships. Loans are borrowing; work-study must be earned. Verify figures with the college.").font(.appCaption).foregroundStyle(colors.muted) }
            }
            if entry.flag("archived") { Button("Restore record") { var e = entry; e.set("archived", false); store.save(collection, e) }.buttonStyle(.bordered) }
            else { Button("Archive record", role: .destructive) { store.archive(collection, id) }.font(.appBody) }
        }.navigationTitle(collection == "tasks" ? "Task" : "Details").navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Edit") { edit = EditTarget(collection, entry) } }
            .sheet(item: $edit) { EntryEditor($0) }
            .confirmationDialog("Restore this essay version? Your current draft will be saved in version history.", isPresented: Binding(get: { restoreVersion != nil }, set: { if !$0 { restoreVersion = nil } }), titleVisibility: .visible) { Button("Restore draft") { restoreDraft() } }
    }
    private func toggleStep(_ stepID: String) { var e = entry; e.set("subtasks", entries: e.entries("subtasks").map { r in var s = r; if s.id == stepID { s.set("done", !s.flag("done")) }; return s }); store.save(collection, e) }
    private func addStep() { var e = entry; var s = Entry.new(title: subtask.trimmingCharacters(in: .whitespacesAndNewlines)); s.set("done", false); e.set("subtasks", entries: e.entries("subtasks") + [s]); if store.save(collection, e) { subtask = "" } }
    private func restoreDraft() { guard let v = restoreVersion else { return }; var e = entry; var snapshot = Entry.new(); snapshot.set("body", e.text("body")); snapshot.set("at", Date().timeIntervalSince1970 * 1000); e.set("versions", entries: e.entries("versions") + [snapshot]); e.set("body", v.text("body")); store.save(collection, e); restoreVersion = nil }
    private var essayReview: some View {
        let checks = entry.fields["reviewChecks"]?.array ?? []
        let labels = ["The opening gives a specific moment or detail.", "The draft shows my actions and perspective.", "Reflection explains why this experience matters.", "Every paragraph supports the prompt.", "College-specific names and details are correct.", "I read it aloud and checked the word limit."]
        let count = entry.text("body").split { $0.isWhitespace || $0.isNewline }.count
        return Panel {
            SectionHeading(title: "Revision checklist", subtitle: "\(count) words" + (entry.number("limit") > 0 ? " / \(Int(entry.number("limit")))" : ""))
            if entry.number("limit") > 0 && Double(count) > entry.number("limit") { Text("\(count - Int(entry.number("limit"))) words over the limit").font(.appCaption).foregroundStyle(.red) }
            ForEach(Array(labels.enumerated()), id: \.offset) { index, label in HStack(alignment: .top) { CheckButton(done: checks.contains(.number(Double(index))), label: label) { var e = entry; var next = checks; let value = JSONValue.number(Double(index)); if let i = next.firstIndex(of: value) { next.remove(at: i) } else { next.append(value) }; e.fields["reviewChecks"] = .array(next); store.save(collection, e) }; Text(label).font(.appBody).padding(.top, 10) } }
        }
    }
}
