import SwiftUI

struct TodayView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.colorScheme) private var scheme
    @State private var edit: EditTarget?
    private var applications: [Entry] { store.workspace.records("applications") }
    private var tasks: [Entry] { store.workspace.records("tasks").filter { $0.text("status") != "Done" }.sorted { ($0.text("due").isEmpty ? "9999" : $0.text("due")) < ($1.text("due").isEmpty ? "9999" : $1.text("due")) } }
    private var portals: [Entry] { tasks.filter { $0.text("category") == "Portal setup" } }
    private var greeting: String { let h = Calendar.current.component(.hour, from: Date()); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening" }
    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 10) {
                Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased()).font(.caption.weight(.semibold)).tracking(1.6).foregroundStyle(.secondary)
                Text("\(greeting),\n\(store.name).").font(.system(size: 34, weight: .semibold, design: .default)).tracking(-1.2).fixedSize(horizontal: false, vertical: true)
                Text("A little clarity for your next chapter.").font(.subheadline).foregroundStyle(.secondary)
            }.padding(.top, 6)

            if store.isEmpty {
                Panel {
                    SectionHeading(title: "Bring your plans with you", subtitle: "Import your Ascend website backup to pick up where you left off. Everything stays on this iPhone.")
                    NavigationLink { TransferView() } label: { Label("Import your workspace", systemImage: "square.and.arrow.down") }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                }
            }

            HStack(spacing: 10) {
                stat("Colleges", value: applications.count, icon: "building.columns", color: Palette.lavender)
                stat("Submitted", value: applications.filter { ["Submitted", "Awaiting Decision", "Accepted", "Waitlisted"].contains($0.text("status")) }.count, icon: "paperplane", color: Palette.mint)
                stat("To do", value: tasks.count, icon: "checklist", color: Palette.peach)
            }.accessibilityElement(children: .combine)

            if !portals.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeading(title: "Open the next door", subtitle: "\(portals.count) applicant portal\(portals.count == 1 ? "" : "s") to set up")
                    Panel {
                        ForEach(Array(portals.prefix(3))) { t in RecordRow(entry: t, collection: "tasks"); if t.id != portals.prefix(3).last?.id { Divider() } }
                        NavigationLink { RecordList(collection: "tasks") } label: { Text("See all portal tasks").font(.subheadline.weight(.semibold)) }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 14) {
                HStack { SectionHeading(title: "Your day"); Spacer(); Button { store.tab = 2 } label: { Image(systemName: "arrow.up.right") }.accessibilityLabel("Open planner") }
                let agenda = store.agenda(from: DateKey.today, to: DateKey.today)
                if agenda.items.isEmpty { EmptyCard(icon: "sun.max", title: "Room to make progress", message: "Add a study session, a game, or anything else on your day’s agenda.") }
                else { Panel { ForEach(Array(agenda.items.prefix(5))) { item in AgendaRow(item: item); if item.id != agenda.items.prefix(5).last?.id { Divider() } } } }
                if !agenda.warnings.isEmpty { Text(agenda.warnings.joined(separator: "\n")).font(.caption).foregroundStyle(.secondary) }
            }

            if !applications.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeading(title: "A step closer", subtitle: "Your application checklists, at a glance")
                    ForEach(Array(applications.prefix(3))) { a in NavigationLink { ApplicationDetail(id: a.id) } label: { ApplicationCard(app: a) }.buttonStyle(.plain) }
                }
            }

            HStack(spacing: 12) {
                Button { edit = EditTarget("tasks") } label: { Label("Add task", systemImage: "plus").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                Button { edit = EditTarget("events") } label: { Label("Add event", systemImage: "calendar.badge.plus").frame(maxWidth: .infinity) }.buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            Label("Saved on this iPhone · Transfer with backups", systemImage: "lock").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity)
        }.navigationTitle("Ascend").navigationBarTitleDisplayMode(.inline)
            .toolbar { NavigationLink { ProfileView() } label: { Image(systemName: "slider.horizontal.3") }.accessibilityLabel("Settings") }
            .sheet(item: $edit) { EntryEditor($0) }
    }
    private func stat(_ title: String, value: Int, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon).font(.body.weight(.medium)).foregroundStyle(Palette.accent)
            Text("\(value)").font(.system(size: 29, weight: .semibold)).tracking(-0.8)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(15).background(color.opacity(scheme == .dark ? 0.18 : 0.40), in: RoundedRectangle(cornerRadius: 22)).overlay { RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(scheme == .dark ? 0.15 : 0.5), lineWidth: 0.7) }
    }
}

struct ApplicationCard: View {
    var app: Entry
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack { RoundedRectangle(cornerRadius: 14).fill(Palette.lavender.opacity(0.55)); Image(systemName: "building.columns").font(.title3).foregroundStyle(Palette.accent) }.frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 8) {
                Text(app.title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                Text(app.text("status")).font(.caption).foregroundStyle(.secondary)
                ProgressView(value: Workspace.progress(app)).tint(Palette.accent)
                HStack { Text("\(Int(Workspace.progress(app) * 100))% checklist"); Spacer(); Text(app.text("deadline").isEmpty ? "Date unverified" : DateKey.label(app.text("deadline"))) }.font(.caption2).foregroundStyle(.secondary)
            }
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 4)
        }.padding(18).background(Color(uiColor: .secondarySystemGroupedBackground).opacity(0.85), in: RoundedRectangle(cornerRadius: 22))
    }
}
