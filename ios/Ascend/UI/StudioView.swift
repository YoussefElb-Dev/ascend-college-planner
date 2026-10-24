import SwiftUI

enum ToolCatalog {
    static let definitions: [Entry] = {
        guard let url = Bundle.main.url(forResource: "workspace-tools", withExtension: "json"), let data = try? Data(contentsOf: url), let rows = try? JSONDecoder().decode([JSONValue].self, from: data) else { return [] }
        return rows.map { Entry($0.object) }
    }()
    static func fields(_ key: String) -> [RecordField]? {
        guard let d = definitions.first(where: { $0.text("key") == key }) else { return nil }
        return d.entries("fields").map { f in
            let kind: RecordField.Kind
            switch f.text("kind") { case "paragraph": kind = .paragraph; case "date": kind = .date; case "number": kind = .number; case "choices": kind = .choices(f.fields["values"]?.array.map(\.text) ?? []); default: kind = .text }
            return .init(f.text("key"), f.text("label"), kind)
        }
    }
}

struct BrandMark: View {
    @Environment(\.ascendColors) private var colors
    var size: CGFloat = 22
    var body: some View { Image("AscendMark").renderingMode(.template).resizable().scaledToFit().foregroundStyle(colors.accent).frame(width: size, height: size).accessibilityHidden(true) }
}

struct StudioView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.ascendColors) private var colors
    private var focusMinutes: Int { Int(store.workspace.records("focusSessions").filter { $0.text("date") >= DateKey.adding(-6, to: DateKey.today) && $0.text("date") <= DateKey.today }.reduce(0) { $0 + $1.number("minutes") }) }
    var body: some View {
        Page {
            SectionHeading(title: "Your studio", subtitle: "School, applications, and everyday progress.")
            HStack(spacing: 8) {
                metric("GPA", StudyModel.gpa(store.workspace.records("courses")).map { String(format:"%.2f",$0) } ?? "—", colors.lavender)
                metric("Focus · 7 days", "\(focusMinutes)m", colors.mint)
                metric("Open assignments", "\(store.workspace.records("assignments").filter { $0.text("status") != "Done" }.count)", colors.peach)
            }
            Panel {
                NavigationLink { FocusView() } label: { Label("Focus timer", systemImage: "timer") }
                Divider()
                NavigationLink { HabitView() } label: { Label("Habit check-ins", systemImage: "checkmark.circle") }
                Divider()
                NavigationLink { ReadinessView() } label: { Label("Submission review", systemImage: "checkmark.seal") }
                Divider()
                NavigationLink { DecisionMatrixView() } label: { Label("Weighted decision matrix", systemImage: "slider.horizontal.3") }
            }
            ForEach(ToolCatalog.definitions.indices, id: \.self) { index in
                let d=ToolCatalog.definitions[index]
                NavigationLink { RecordList(collection: d.text("key")) } label: {
                    Panel { HStack { Image(systemName: d.text("symbol")).foregroundStyle(colors.accent).frame(width: 26); VStack(alignment: .leading, spacing: 3) { Text(d.title).font(.appHeadline).foregroundStyle(colors.text); Text(d.text("description")).font(.appCaption).foregroundStyle(colors.muted) }; Spacer(); Text("\(store.workspace.records(d.text("key")).count)").font(.appCaption).foregroundStyle(colors.muted) } }
                }.buttonStyle(.plain)
            }
            Text("GPA is a credit-weighted estimate from self-reported 0–4 grade points. It does not replace an official transcript.").font(.appCaption).foregroundStyle(colors.muted)
        }.navigationTitle("Studio & tools").navigationBarTitleDisplayMode(.inline)
    }
    private func metric(_ title: String, _ value: String, _ color: Color) -> some View { VStack(alignment: .leading, spacing: 4) { Text(value).font(.appTitle); Text(title).font(.appMicro).foregroundStyle(colors.muted) }.frame(maxWidth: .infinity, alignment: .leading).padding(10).background(color, in: RoundedRectangle(cornerRadius: 14)) }
}

struct HabitView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.ascendColors) private var colors
    @State private var edit: EditTarget?
    var body: some View {
        Page {
            SectionHeading(title: "A little, every day", subtitle: "Tap a day to record or reopen a check-in.")
            if store.workspace.records("habits").isEmpty { EmptyCard(icon: "checkmark.circle", title: "Start a habit", message: "Reading, practice, sleep, or a daily application check-in.") }
            ForEach(store.workspace.records("habits")) { habit in
                Panel {
                    HStack { Text(habit.title).font(.appHeadline); Spacer(); Button { edit = EditTarget("habits", habit) } label: { Image(systemName: "pencil") }.accessibilityLabel("Edit " + habit.title) }
                    HStack(spacing: 0) {
                        ForEach((-6...0).map { DateKey.adding($0, to: DateKey.today) }, id: \.self) { day in
                            let done = habit.fields["doneDates"]?.array.contains(.string(day)) ?? false
                            Button { store.change { w in var r = w.entry("habits", habit.id)!; var dates = r.fields["doneDates"]?.array ?? []; if done { dates.removeAll { $0 == .string(day) } } else { dates.append(.string(day)) }; r.fields["doneDates"] = .array(dates); w.upsert("habits",r) } } label: { VStack(spacing: 4) { Text(String(Int(day.suffix(2)) ?? 1)).font(.appMicro); Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.appSection) }.frame(maxWidth: .infinity, minHeight: 44).foregroundStyle(done ? colors.accent : colors.muted) }.buttonStyle(.plain).accessibilityLabel(habit.title + " " + day + (done ? " complete" : " incomplete"))
                        }
                    }
                    Text("\(StudyModel.streak(habit,today:DateKey.today)) day current streak").font(.appCaption).foregroundStyle(colors.muted)
                }
            }
        }.navigationTitle("Habits").navigationBarTitleDisplayMode(.inline).toolbar { Button { edit = EditTarget("habits") } label: { Image(systemName: "plus") }.accessibilityLabel("Add habit") }.sheet(item: $edit) { EntryEditor($0) }
    }
}

struct FocusView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.ascendColors) private var colors
    @AppStorage("focusTitle") private var title = ""
    @AppStorage("focusMinutes") private var minutes = 25
    @AppStorage("focusEnd") private var end = 0.0
    @AppStorage("focusRemaining") private var paused = 0
    @State private var notice = ""
    private var active: Bool { end > 0 || paused > 0 }
    private func remaining(_ now: Date) -> Int { end > 0 ? max(0,Int(ceil(end-now.timeIntervalSince1970))) : paused }
    var body: some View {
        Page {
            SectionHeading(title: "One thing at a time", subtitle: "The timer stays accurate when you leave the app. No background alarm is scheduled.")
            Panel {
                TextField("What will you work on?", text: $title).accessibilityIdentifier("focusTitle").disabled(active)
                if !active { Stepper("\(minutes) minutes", value: $minutes, in: 1...180) }
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    let left = remaining(context.date)
                    Text(String(format:"%02d:%02d",left/60,left%60)).font(.custom("PlusJakartaSans-Regular",size:52,relativeTo:.largeTitle).weight(.semibold)).monospacedDigit().frame(maxWidth:.infinity).padding(.vertical,12)
                    if active && left == 0 { Text("Session complete. Save your work to the focus log.").font(.appCaption) }
                }
                if active {
                    HStack { Button(end > 0 ? "Pause" : "Resume") { if end > 0 { paused = remaining(Date()); end = 0 } else { end = Date().timeIntervalSince1970 + Double(paused) } }.buttonStyle(.bordered); Button("Save session") { save() }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent) }
                    Button("Discard", role: .destructive) { paused = 0; end = 0 }
                } else { Button("Start focus block") { paused = minutes * 60; end = Date().timeIntervalSince1970 + Double(paused); notice = "" }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent).disabled(title.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty) }
                if !notice.isEmpty { Text(notice).font(.appCaption).foregroundStyle(colors.muted) }
            }
            NavigationLink("View focus history") { RecordList(collection:"focusSessions") }
        }.navigationTitle("Focus timer").navigationBarTitleDisplayMode(.inline)
    }
    private func save() {
        let duration = (minutes * 60 - remaining(Date())) / 60
        guard duration >= 1 else { notice = "Focus for at least a minute before saving."; return }
        var r = Entry.new(title:title); r.set("date",DateKey.today); r.set("minutes",Double(duration))
        if store.save("focusSessions",r) { paused = 0; end = 0; notice = "Saved to your focus log." }
    }
}

struct ReadinessView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.ascendColors) private var colors
    var body: some View {
        Page {
            SectionHeading(title:"Submission review",subtitle:"Based on your tracked requirements. Confirm every item in the official portal.")
            ForEach(store.workspace.records("applications")) { a in
                let missing = a.entries("requirements").filter { $0.fields["required"] != .bool(false) && !$0.flag("done") && !$0.flag("exempt") }
                Panel {
                    NavigationLink { ApplicationDetail(id:a.id) } label: { Text(a.title).font(.appHeadline) }
                    Text(a.text("deadline").isEmpty ? "Deadline not verified" : DateKey.label(a.text("deadline"))).font(.appCaption).foregroundStyle(colors.muted)
                    Text("\(missing.count) required items open").font(.appBody.weight(.semibold))
                    ForEach(missing) { r in Label(r.title,systemImage:"circle").font(.appCaption).foregroundStyle(colors.muted) }
                    Text("\(store.workspace.records("receipts").filter { $0.text("applicationId") == a.id }.count) saved submission receipts").font(.appCaption)
                }
            }
            NavigationLink("Submission receipts") { RecordList(collection:"receipts") }
            NavigationLink("Essay prompt bank") { RecordList(collection:"prompts") }
        }.navigationTitle("Submission review").navigationBarTitleDisplayMode(.inline)
    }
}

struct DecisionMatrixView: View {
    @EnvironmentObject var store: WorkspaceStore
    @State private var weights: [String: Double] = [:]
    @State private var edit: EditTarget?
    private var currentWeights: [String: JSONValue] { store.workspace.profile.fields["decisionWeights"]?.object ?? [:] }
    var body: some View {
        Page {
            SectionHeading(title:"What matters to you?",subtitle:"Personal fit ratings from 1–5, weighted by your priorities. Missing ratings are excluded.")
            Panel {
                ForEach(StudyModel.factors,id:\.self) { key in Stepper("\(key.capitalized): \(Int(weights[key] ?? 1))",value:Binding(get:{weights[key] ?? 1},set:{weights[key]=$0}),in:0...100,step:1) }
                Button("Save weights") { store.change { w in var p=w.profile;p.fields["decisionWeights"] = .object(weights.mapValues(JSONValue.number));w.profile=p } }.disabled(weights.values.allSatisfy{$0==0})
            }
            ForEach(store.workspace.records("collegeScores").sorted { (StudyModel.fit($0,weights:currentWeights) ?? -1) > (StudyModel.fit($1,weights:currentWeights) ?? -1) }) { r in
                Button { edit=EditTarget("collegeScores",r) } label: { Panel { HStack { Text(r.title).font(.appHeadline);Spacer();Text(StudyModel.fit(r,weights:currentWeights).map { String(format:"%.2f / 5",$0) } ?? "No ratings").font(.appBody) } } }.buttonStyle(.plain)
            }
            Button("Add college ratings") { edit=EditTarget("collegeScores") }.buttonStyle(.bordered)
        }.navigationTitle("Decision matrix").navigationBarTitleDisplayMode(.inline).onAppear { weights=Dictionary(uniqueKeysWithValues:StudyModel.factors.map{($0,currentWeights[$0]?.number ?? 1)}) }.sheet(item:$edit){EntryEditor($0)}
    }
}
