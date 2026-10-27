import SwiftUI

struct MissionView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var filter = "All"
    @State private var phaseFilter = "All"
    @State private var view = "Overview"
    @State private var edit: EditTarget?
    private var tasks: [Entry] { store.workspace.records("tasks") }
    private var apps: [Entry] { store.workspace.records("applications") }
    private func count(_ status: String) -> Int { tasks.filter { MissionModel.status($0) == status }.count }
    private func color(_ status: String) -> Color { status == "Done" ? Color(hex: colors.dark ? 0x9dbc88 : 0x5e7d50) : status == "In Progress" ? colors.accent : status == "Waiting" ? Color(hex: 0x8694ac) : Color(hex: 0xb3bdcd) }
    private func phaseTasks(_ id: String) -> [Entry] { tasks.filter { MissionModel.phase($0) == id } }
    private func visibleTasks(_ id: String) -> [Entry] {
        phaseTasks(id).filter { filter == "All" || MissionModel.status($0) == filter }.sorted {
            let ad = MissionModel.status($0) == "Done", bd = MissionModel.status($1) == "Done"
            if ad != bd { return !ad }
            return ($0.text("due").isEmpty ? "9999" : $0.text("due")) < ($1.text("due").isEmpty ? "9999" : $1.text("due"))
        }
    }
    var body: some View {
        Page {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) { Text("MY WORKSPACE").font(.appMicro.weight(.semibold)).tracking(1.4).foregroundStyle(colors.muted); Text("Mission Map").font(.appTitle) }
                Spacer()
                Button { edit = EditTarget("tasks") } label: { Label("Add task", systemImage: "plus").font(.appCaption.weight(.semibold)) }.buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: 8)).foregroundStyle(colors.onAccent)
            }.padding(.vertical, 4)
            HStack(spacing: 8) {
                Picker("Plan view", selection: $view) { Text("Overview").tag("Overview"); Text("Board").tag("Board") }.pickerStyle(.segmented).accessibilityIdentifier("missionView")
                Button { store.tab = 2 } label: { Image(systemName: "calendar").frame(width: 30, height: 30) }.accessibilityLabel("Calendar view")
                NavigationLink { FocusView() } label: { Image(systemName: "timer").frame(width: 30, height: 30) }.accessibilityLabel("Focus view")
            }
            statusPanel
            phaseStrip
            if store.isEmpty {
                Panel { SectionHeading(title: "Bring your plans with you", subtitle: "Connect your existing workspace or import a backup to pick up where you left off."); NavigationLink { DeviceSyncView() } label: { Label("Connect device sync", systemImage: "arrow.triangle.2.circlepath") }; NavigationLink { TransferView() } label: { Label("Import your workspace", systemImage: "square.and.arrow.down") } }
            }
            VStack(alignment: .leading, spacing: 12) {
                HStack { SectionHeading(title: "Your plan", subtitle: "\(tasks.count) tasks in 5 focus areas"); Spacer(); if phaseFilter != "All" { Button("Clear area") { phaseFilter = "All" }.font(.appCaption) } }
                if view == "Board" { board }
                else { taskFilters; taskGroups }
            }
            if !apps.isEmpty {
                HStack { Text("Application progress").font(.appSection); Spacer(); Button("View all") { store.tab = 1 }.font(.appCaption) }.padding(.top, 8)
                ForEach(Array(apps.prefix(3))) { app in NavigationLink { ApplicationDetail(id: app.id) } label: { ApplicationCard(app: app) }.buttonStyle(.plain) }
            }
            HStack { Text("Your day").font(.appSection); Spacer(); Button("Planner") { store.tab = 2 }.font(.appCaption) }.padding(.top, 8)
            let agenda = store.agenda(from: DateKey.today, to: DateKey.today)
            if agenda.items.isEmpty { Text("Your deadlines and personal plans appear here.").font(.appCaption).foregroundStyle(colors.muted) }
            else { Panel { ForEach(Array(agenda.items.prefix(4))) { AgendaRow(item: $0) } } }
            NavigationLink { DeviceSyncView() } label: { Label("Private workspace · Device sync", systemImage: "lock.shield").font(.appMicro).foregroundStyle(colors.muted).frame(maxWidth: .infinity).padding(.vertical, 10) }
        }.navigationTitle("Ascend").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .principal) { HStack(spacing: 7) { BrandMark(); Text("Ascend").font(.appHeadline) } }; ToolbarItem(placement: .primaryAction) { NavigationLink { ProfileView() } label: { Image(systemName: "slider.horizontal.3") }.accessibilityLabel("Settings") } }
            .sheet(item: $edit) { EntryEditor($0) }
    }
    private var statusPanel: some View {
        Panel {
            HStack { Text("By status").font(.appHeadline); Spacer(); Text("\(count("Done")) of \(tasks.count) done").font(.appMicro).foregroundStyle(colors.muted) }.padding(.bottom, 4)
            ForEach(MissionModel.statuses, id: \.self) { status in
                Button { filter = status; view = "Overview" } label: {
                    HStack(spacing: 10) { RoundedRectangle(cornerRadius: 4).fill(color(status)).frame(width: 12, height: 12); Text(status == "In Progress" ? "In progress" : status).font(.appCaption).foregroundStyle(colors.text).frame(width: 82, alignment: .leading); ProgressView(value: tasks.isEmpty ? 0 : Double(count(status)) / Double(tasks.count)).tint(color(status)); Text("\(count(status))").font(.appCaption).monospacedDigit().foregroundStyle(colors.muted).frame(width: 24, alignment: .trailing) }.padding(.vertical, 3)
                }.buttonStyle(.plain).accessibilityLabel("Show \(status) tasks")
            }
        }
    }
    private var phaseStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 9) {
                ForEach(MissionPhase.all) { phase in phaseCard(phase) }
            }.padding(.vertical, 2)
        }.padding(.bottom, 6)
    }
    private func phaseCard(_ phase: MissionPhase) -> some View {
        let items = phaseTasks(phase.id)
        let done = items.filter { MissionModel.status($0) == "Done" }.count
        let progress = items.isEmpty ? 0 : Double(done) / Double(items.count)
        return Button { phaseFilter = phaseFilter == phase.id ? "All" : phase.id } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) { Image(systemName: phase.symbol).font(.appCaption).foregroundStyle(colors.accent).frame(width: 24, height: 24).background(colors.blue, in: RoundedRectangle(cornerRadius: 6)); Text(phase.title).font(.appMicro.weight(.semibold)).foregroundStyle(colors.text).fixedSize(horizontal: false, vertical: true) }.frame(height: 30, alignment: .leading)
                HStack(spacing: 12) { MissionRing(value: progress); VStack(alignment: .leading, spacing: 4) { (Text("\(done)").font(.appTitle) + Text("/\(items.count)").font(.appCaption).foregroundColor(colors.muted)); Text("tasks done").font(.appMicro).foregroundStyle(colors.muted) } }
                Text(items.isEmpty ? "Ready for your first task" : "\(items.count - done) remaining").font(.appMicro).foregroundStyle(colors.muted)
                ProgressView(value: progress).tint(colors.accent)
            }.padding(13).frame(width: 172, alignment: .leading).background(LinearGradient(colors: [colors.solid, colors.blue.opacity(0.6)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 11)).overlay { RoundedRectangle(cornerRadius: 11).stroke(phaseFilter == phase.id ? colors.accent : colors.border, lineWidth: 1) }
        }.buttonStyle(.plain).accessibilityLabel("\(phase.title), \(done) of \(items.count) done").accessibilityAddTraits(phaseFilter == phase.id ? .isSelected : [])
    }
    private var taskFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 6) { ForEach(["All", "In Progress", "Waiting", "To do", "Done"], id: \.self) { status in Button { filter = status } label: { Text("\(status == "Done" ? "Completed" : status) \(status == "All" ? tasks.count : count(status))").font(.appMicro.weight(.medium)).padding(.horizontal, 12).padding(.vertical, 9).background(filter == status ? colors.text : colors.solid, in: Capsule()).foregroundStyle(filter == status ? colors.solid : colors.muted).overlay { Capsule().stroke(colors.border, lineWidth: 1) } }.buttonStyle(.plain) } } }
    }
    private var taskGroups: some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(MissionPhase.all.filter { phaseFilter == "All" || phaseFilter == $0.id }) { phase in
                let items = visibleTasks(phase.id)
                if !items.isEmpty {
                    VStack(alignment: .leading, spacing: 9) { HStack { Label(phase.title, systemImage: phase.symbol).font(.appCaption.weight(.semibold)); Spacer(); Text("\(items.count)").font(.appMicro).foregroundStyle(colors.muted) }; Divider(); ForEach(Array(items.prefix(4))) { taskCard($0) }; if items.count > 4 { NavigationLink { RecordList(collection: "tasks") } label: { Text("View all tasks →").font(.appCaption) } } }
                }
            }
            if tasks.isEmpty { EmptyCard(icon: "checklist", title: "Give your next steps a home", message: "Add application tasks, schoolwork, or personal plans.") }
            else if !MissionPhase.all.contains(where: { (phaseFilter == "All" || phaseFilter == $0.id) && !visibleTasks($0.id).isEmpty }) { Text("No tasks in this view. Choose another filter.").font(.appCaption).foregroundStyle(colors.muted).padding(.vertical, 16) }
        }
    }
    private var board: some View {
        ScrollView(.horizontal, showsIndicators: false) { HStack(alignment: .top, spacing: 12) { ForEach(MissionModel.statuses, id: \.self) { status in VStack(alignment: .leading, spacing: 10) { HStack { Circle().fill(color(status)).frame(width: 7, height: 7); Text(status).font(.appCaption.weight(.semibold)); Spacer(); Text("\(count(status))").font(.appMicro).foregroundStyle(colors.muted) }; ForEach(tasks.filter { MissionModel.status($0) == status && (phaseFilter == "All" || MissionModel.phase($0) == phaseFilter) }) { taskCard($0) } }.padding(12).frame(width: 265).background(colors.background, in: RoundedRectangle(cornerRadius: 12)) } } }
    }
    private func taskCard(_ task: Entry) -> some View {
        let done = MissionModel.status(task) == "Done"
        return HStack(alignment: .top, spacing: 2) {
            CheckButton(done: done, label: task.title) { store.toggleTask(task.id) }.frame(width: 34)
            Button { edit = EditTarget("tasks", task) } label: { VStack(alignment: .leading, spacing: 7) { Text(task.title).font(.appCaption.weight(.semibold)).foregroundStyle(done ? colors.muted : colors.text).multilineTextAlignment(.leading).fixedSize(horizontal: false, vertical: true); Text(apps.first { $0.id == task.text("applicationId") }?.title ?? task.text("category")).font(.appMicro).foregroundStyle(colors.muted); HStack { Text(MissionModel.status(task)).foregroundStyle(color(MissionModel.status(task))); Spacer(); if !task.text("due").isEmpty { Text(DateKey.label(task.text("due"))).foregroundStyle(colors.muted) } }.font(.appMicro) }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10) }.buttonStyle(.plain)
        }.padding(.horizontal, 7).padding(.trailing, 7).background(colors.solid, in: RoundedRectangle(cornerRadius: 10)).overlay { RoundedRectangle(cornerRadius: 10).stroke(colors.border, lineWidth: 1) }
    }
}

struct MissionRing: View {
    @Environment(\.ascendColors) private var colors
    var value: Double
    var body: some View { ZStack { Circle().fill(colors.blue); Circle().stroke(colors.border, lineWidth: 6); Circle().trim(from: 0, to: min(1, max(0, value))).stroke(colors.accent, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90)); Text("\(Int((value * 100).rounded()))%").font(.appCaption.weight(.bold)).monospacedDigit() }.frame(width: 47, height: 47).accessibilityLabel("\(Int((value * 100).rounded())) percent complete") }
}
