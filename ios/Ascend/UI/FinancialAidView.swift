import SwiftUI

struct FinancialAidView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.ascendColors) private var colors
    @State private var category = "FAFSA"
    @State private var edit: EditTarget?
    private var records: [Entry] { AidModel.records(store.workspace, category: category) }
    var body: some View {
        Page {
            SectionHeading(title: "Financial aid", subtitle: "Your admissions are separate. Keep FAFSA, CSS Profile, and supporting aid documents here.")
            Picker("Aid application", selection: $category) { Text("FAFSA").tag("FAFSA"); Text("CSS Profile").tag("CSS Profile"); Text("Other").tag("Other aid") }.pickerStyle(.segmented)
            Panel {
                HStack { VStack(alignment: .leading, spacing: 4) { Text(category).font(.appSection); Text("\(records.filter { AidModel.isComplete($0) }.count) of \(records.count) complete").font(.appCaption).foregroundStyle(colors.muted) }; Spacer(); Image(systemName: "leaf.fill").font(.appTitle).foregroundStyle(colors.accent).padding(14).background(colors.mint, in: Circle()) }
                if !records.isEmpty { ProgressView(value: Double(records.filter { AidModel.isComplete($0) }.count), total: Double(records.count)) }
                SafeLink(title: category == "FAFSA" ? "Open StudentAid.gov" : category == "CSS Profile" ? "Open CSS Profile" : "Open IDOC", address: category == "FAFSA" ? "https://studentaid.gov/h/apply-for-aid/fafsa" : category == "CSS Profile" ? "https://cssprofile.collegeboard.org/" : "https://idoc.collegeboard.org/")
            }
            if records.isEmpty { EmptyCard(icon: "leaf", title: "Keep aid in its own space", message: "Add an aid form or document request. It will sync with the website and will not reduce your college application progress.") }
            ForEach(records) { record in
                Panel {
                    if record.flag("legacy") {
                        Text(record.title).font(.appHeadline); Text(store.workspace.collegeName(for: record)).font(.appCaption).foregroundStyle(colors.muted); StatusPill(text: record.text("status"))
                        Button(record.flag("done") ? "Reopen aid requirement" : "Mark aid requirement complete") { store.toggleRequirement(record.text("applicationId"), record.id) }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                    } else { RecordRow(entry: record, collection: "aid") }
                }
            }
        }.navigationTitle("FAFSA & CSS").navigationBarTitleDisplayMode(.inline)
            .toolbar { Button { var entry = RecordSpec.new("aid"); entry.set("category", category == "Other aid" ? "Other" : category); edit = EditTarget("aid", entry) } label: { Image(systemName: "plus") }.accessibilityLabel("Add aid record") }
            .sheet(item: $edit) { EntryEditor($0) }
    }
}
