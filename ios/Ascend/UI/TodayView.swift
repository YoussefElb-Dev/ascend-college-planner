import SwiftUI

struct TodayView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var edit: EditTarget?
    private var applications: [Entry] { store.workspace.records("applications") }
    private var tasks: [Entry] { store.workspace.records("tasks").filter { $0.text("status") != "Done" }.sorted { ($0.text("due").isEmpty ? "9999" : $0.text("due")) < ($1.text("due").isEmpty ? "9999" : $1.text("due")) } }
    private var portals: [Entry] { tasks.filter { $0.text("category") == "Portal setup" } }
    private var greeting: String { let h = Calendar.current.component(.hour, from: Date()); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening" }
    var body: some View {
        Page {
            VStack(alignment: .leading, spacing: 6) {
                Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased()).font(.appMicro.weight(.semibold)).tracking(1).foregroundStyle(colors.muted)
                Text("\(greeting), \(store.name).").font(.appTitle).tracking(-0.7).fixedSize(horizontal: false, vertical: true)
                Text("A little clarity for your next chapter.").font(.appCaption).foregroundStyle(colors.muted)
            }.frame(maxWidth: .infinity, alignment: .leading).padding(14)
                .background(LinearGradient(colors: colors.hero.map { $0.opacity(0.78) }, startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 16))
                .overlay { RoundedRectangle(cornerRadius: 16).stroke(colors.border, lineWidth: 0.7) }

            if store.isEmpty {
                Panel {
                    SectionHeading(title: "Bring your plans with you", subtitle: "Import your Ascend website backup to pick up where you left off. Everything stays on this iPhone.")
                    NavigationLink { TransferView() } label: { Label("Import your workspace", systemImage: "square.and.arrow.down") }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent).buttonBorderShape(.capsule)
                }
            }

            HStack(spacing: 8) {
                stat("Colleges", value: applications.count, icon: "building.columns", color: colors.lavender)
                stat("Submitted", value: applications.filter { ["Submitted", "Awaiting Decision", "Accepted", "Waitlisted"].contains($0.text("status")) }.count, icon: "paperplane", color: colors.mint)
                stat("To do", value: tasks.count, icon: "checklist", color: colors.peach)
            }.accessibilityElement(children: .combine)

            if !portals.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeading(title: "Open the next door", subtitle: "\(portals.count) applicant portal\(portals.count == 1 ? "" : "s") to set up")
                    Panel {
                        ForEach(Array(portals.prefix(3))) { t in RecordRow(entry: t, collection: "tasks"); if t.id != portals.prefix(3).last?.id { Divider() } }
                        NavigationLink { RecordList(collection: "tasks") } label: { Text("See all portal tasks").font(.appBody.weight(.semibold)) }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                HStack { SectionHeading(title: "Your day"); Spacer(); Button { store.tab = 2 } label: { Image(systemName: "arrow.up.right") }.accessibilityLabel("Open planner") }
                let agenda = store.agenda(from: DateKey.today, to: DateKey.today)
                if agenda.items.isEmpty { EmptyCard(icon: "sun.max", title: "Room to make progress", message: "Add a study session, a game, or anything else on your day’s agenda.") }
                else { Panel { ForEach(Array(agenda.items.prefix(5))) { item in AgendaRow(item: item); if item.id != agenda.items.prefix(5).last?.id { Divider() } } } }
                if !agenda.warnings.isEmpty { Text(agenda.warnings.joined(separator: "\n")).font(.appCaption).foregroundStyle(colors.muted) }
            }

            if !applications.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeading(title: "A step closer", subtitle: "Your application checklists, at a glance")
                    ForEach(Array(applications.prefix(3))) { a in NavigationLink { ApplicationDetail(id: a.id) } label: { ApplicationCard(app: a) }.buttonStyle(.plain) }
                }
            }

            HStack(spacing: 12) {
                Button { edit = EditTarget("tasks") } label: { Label("Add task", systemImage: "plus").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent).buttonBorderShape(.capsule)
                Button { edit = EditTarget("events") } label: { Label("Add event", systemImage: "calendar.badge.plus").frame(maxWidth: .infinity) }.buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            Label("Saved on this iPhone · Transfer with backups", systemImage: "lock").font(.appCaption).foregroundStyle(colors.muted).frame(maxWidth: .infinity)
        }.navigationTitle("Ascend").navigationBarTitleDisplayMode(.inline)
            .toolbar { NavigationLink { ProfileView() } label: { Image(systemName: "slider.horizontal.3") }.accessibilityLabel("Settings") }
            .sheet(item: $edit) { EntryEditor($0) }
    }
    private func stat(_ title: String, value: Int, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.appBody.weight(.medium)).foregroundStyle(colors.accent)
                Text("\(value)").font(.appTitle).monospacedDigit().tracking(-0.7)
            }
            Text(title).font(.appCaption).foregroundStyle(colors.muted)
        }.frame(maxWidth: .infinity, alignment: .leading).padding(12).background(color, in: RoundedRectangle(cornerRadius: 14)).overlay { RoundedRectangle(cornerRadius: 14).stroke(colors.border, lineWidth: 0.7) }
    }
}

struct ApplicationCard: View {
    @Environment(\.ascendColors) private var colors
    var app: Entry
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack { RoundedRectangle(cornerRadius: 10).fill(colors.lavender); Image(systemName: "building.columns").font(.appSection).foregroundStyle(colors.accent) }.frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 5) {
                Text(app.title).font(.appBody.weight(.semibold)).foregroundStyle(colors.text).fixedSize(horizontal: false, vertical: true)
                Text(app.text("status")).font(.appCaption).foregroundStyle(colors.muted)
                ProgressView(value: Workspace.progress(app)).tint(colors.accent)
                HStack { Text("\(Int(Workspace.progress(app) * 100))% checklist"); Spacer(); Text(app.text("deadline").isEmpty ? "Date unverified" : DateKey.label(app.text("deadline"))) }.font(.appMicro).foregroundStyle(colors.muted)
            }
            Image(systemName: "chevron.right").font(.appCaption.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 4)
        }.padding(12).background(colors.surface, in: RoundedRectangle(cornerRadius: 16)).overlay { RoundedRectangle(cornerRadius: 16).stroke(colors.border, lineWidth: 0.7) }
    }
}
