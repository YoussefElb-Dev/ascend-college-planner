import SwiftUI

struct PlannerView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @State private var selected = DateKey.today
    @State private var focus = Date()
    @State private var zoom = "Month"
    @State private var edit: EditTarget?
    @State private var note = ""
    @State private var showNote = false
    private var days: [String] {
        let cal = DateKey.calendar
        let start: Date
        let count: Int
        if zoom == "Day" { return [selected] }
        if zoom == "Week" { let d = DateKey.date(selected)!; let weekday = cal.component(.weekday, from: d); start = cal.date(byAdding: .day, value: -((weekday + 5) % 7), to: d)!; count = 7 }
        else { let d = cal.date(from: cal.dateComponents([.year, .month], from: focus))!; let weekday = cal.component(.weekday, from: d); start = cal.date(byAdding: .day, value: -((weekday + 5) % 7), to: d)!; count = 42 }
        return (0..<count).map { DateKey.string(cal.date(byAdding: .day, value: $0, to: start)!) }
    }
    var body: some View {
        let visibleDays = days
        let agenda = store.agenda(from: visibleDays.first!, to: visibleDays.last!)
        Page {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) { Text(focus.formatted(.dateTime.month(.wide).year())).font(.appTitle).tracking(-0.6); Text("Your whole life, in view.").font(.appCaption).foregroundStyle(colors.muted) }
                Spacer()
                Button("Today") { focus = Date(); selected = DateKey.today }.font(.appBody.weight(.medium)).buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            Picker("Calendar view", selection: $zoom) { ForEach(["Month", "Week", "Day"], id: \.self) { Text($0).tag($0) } }.pickerStyle(.segmented).accessibilityIdentifier("calendarZoom")
            VStack(spacing: 4) {
                HStack {
                    Button { move(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("Previous " + zoom.lowercased())
                    Spacer()
                    Text(zoom == "Month" ? "MONTH AT A GLANCE" : zoom == "Week" ? "THIS WEEK" : "YOUR DAY").font(.appMicro.weight(.semibold)).tracking(1.5).foregroundStyle(colors.muted)
                    Spacer()
                    Button { move(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }.accessibilityLabel("Next " + zoom.lowercased())
                }
                if zoom != "Day" {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
                        ForEach(["M", "T", "W", "T", "F", "S", "S"].enumerated().map { DayLabel(id: $0.offset, label: $0.element) }) { Text($0.label).font(.appMicro.weight(.medium)).foregroundStyle(colors.muted).frame(maxWidth: .infinity).padding(.bottom, 4) }
                        ForEach(visibleDays, id: \.self) { day in dayCell(day, items: agenda.items) }
                    }
                } else { Text(DateKey.date(selected)!.formatted(.dateTime.weekday(.wide).month(.wide).day())).font(.appHeadline).frame(maxWidth: .infinity, alignment: .leading) }
            }.padding(10).glassPanel()
                .simultaneousGesture(MagnificationGesture().onEnded { scale in if scale > 1.15 { zoom = zoom == "Month" ? "Week" : "Day" } else if scale < 0.85 { zoom = zoom == "Day" ? "Week" : "Month" } })
            HStack {
                SectionHeading(title: DateKey.date(selected)!.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                Spacer()
                Button { addEvent() } label: { Image(systemName: "plus").padding(12).glassPanel(30) }.accessibilityLabel("Add event on selected day")
            }
            let selectedItems = agenda.items.filter { $0.occurs(on: selected) }
            if selectedItems.isEmpty { EmptyCard(icon: "calendar", title: "Make this day yours", message: "Classes, volleyball, work, study time, or a break. Add anything you want to plan.") }
            else { Panel { ForEach(selectedItems) { item in AgendaRow(item: item); if item.id != selectedItems.last?.id { Divider() } } } }
            if !agenda.warnings.isEmpty { Panel { Label("Calendar notice", systemImage: "info.circle").font(.appBody.weight(.semibold)); ForEach(agenda.warnings, id: \.self) { Text($0).font(.appCaption).foregroundStyle(colors.muted) } } }
            Panel {
                HStack { Label("Day notes", systemImage: "note.text").font(.appHeadline); Spacer(); Button("Edit") { note = store.workspace.all("dayNotes").first { $0.text("date") == selected }?.text("body") ?? ""; showNote = true }.font(.appBody.weight(.medium)) }
                let text = store.workspace.all("dayNotes").first { $0.text("date") == selected }?.text("body") ?? ""
                Text(text.isEmpty ? "A plan, a reflection, or something to remember." : text).font(.appBody).foregroundStyle(text.isEmpty ? .secondary : .primary).textSelection(.enabled)
            }
            NavigationLink { TransferView(initialCalendar: true) } label: { Label("Import or export a calendar", systemImage: "arrow.triangle.2.circlepath").font(.appBody.weight(.medium)) }
            Text("Deadlines and due dates appear alongside your personal events. Tap a date twice to open its day view, or pinch to change the level of detail.").font(.appCaption).foregroundStyle(colors.muted)
            Text("Personal events use this iPhone’s time zone (\(TimeZone.current.identifier)). Deadlines keep their recorded time zone.").font(.appCaption).foregroundStyle(colors.muted)
        }.navigationTitle("Planner").navigationBarTitleDisplayMode(.inline)
            .toolbar { Menu { Button("Add event", action: addEvent); Button("Add task") { var t = RecordSpec.new("tasks"); t.set("due", selected); edit = EditTarget("tasks", t) } } label: { Image(systemName: "plus") }.accessibilityLabel("Add to planner") }
            .sheet(item: $edit) { EntryEditor($0) }
            .sheet(isPresented: $showNote) { NavigationStack { Form { Section(DateKey.label(selected)) { TextEditor(text: $note).frame(minHeight: 300).accessibilityLabel("Day note") } }.navigationTitle("Day notes").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showNote = false } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { if store.dayNote(selected, body: note) { showNote = false } } } } } }
    }
    private func dayCell(_ day: String, items: [AgendaItem]) -> some View {
        let isSelected = selected == day, today = day == DateKey.today
        let inMonth = String(day.prefix(7)) == String(DateKey.string(focus).prefix(7))
        return Button { selected = day; if zoom != "Month" { focus = DateKey.date(day)! } } label: {
            VStack(spacing: 2) {
                Text(String(Int(day.suffix(2)) ?? 1)).font(.appCaption.weight(isSelected || today ? .semibold : .regular)).foregroundStyle(isSelected ? colors.onAccent : inMonth || zoom != "Month" ? colors.text : colors.muted.opacity(0.6)).frame(width: 28, height: 28).background(isSelected ? colors.accent : today ? colors.lavender : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                HStack(spacing: 3) { ForEach(Array(items.filter { $0.occurs(on: day) }.prefix(3).enumerated()), id: \.offset) { _, item in Circle().fill(item.collection == "events" ? colors.accent : Color.secondary.opacity(0.45)).frame(width: 4, height: 4) } }.frame(height: 5)
            }.frame(maxWidth: .infinity, minHeight: 44).contentShape(Rectangle())
        }.buttonStyle(.plain).accessibilityLabel((DateKey.date(day)?.formatted(date: .complete, time: .omitted) ?? day) + ", \(items.filter { $0.occurs(on: day) }.count) items").accessibilityAddTraits(isSelected ? .isSelected : [])
            .simultaneousGesture(TapGesture(count: 2).onEnded { selected = day; focus = DateKey.date(day)!; zoom = "Day" })
    }
    private func move(_ amount: Int) {
        if zoom == "Month" { focus = DateKey.calendar.date(byAdding: .month, value: amount, to: focus)!; selected = DateKey.string(focus) }
        else { selected = DateKey.adding(amount * (zoom == "Week" ? 7 : 1), to: selected); focus = DateKey.date(selected)! }
    }
    private func addEvent() { var e = RecordSpec.new("events"); e.set("date", selected); e.set("endDate", selected); edit = EditTarget("events", e) }
}
private struct DayLabel: Identifiable { let id: Int; let label: String }

struct AgendaRow: View {
    @Environment(\.ascendColors) private var colors
    var item: AgendaItem
    var body: some View {
        NavigationLink { RecordDetailOrApplication(item: item) } label: {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) { Text(item.time.isEmpty ? (item.collection == "events" && item.record.flag("allDay") ? "All day" : "Date only") : item.time).font(.appCaption.weight(.semibold)).monospacedDigit(); if !item.record.text("endTime").isEmpty { Text(item.record.text("endTime")).font(.appMicro).foregroundStyle(colors.muted) } }.frame(width: 54, alignment: .leading).padding(.top, 3)
                RoundedRectangle(cornerRadius: 2).fill(item.collection == "events" ? colors.accent.opacity(0.6) : colors.mint).frame(width: 3)
                VStack(alignment: .leading, spacing: 6) { Text(item.title).font(.appBody.weight(.medium)).foregroundStyle(colors.text).fixedSize(horizontal: false, vertical: true); Text(item.kind).font(.appCaption).foregroundStyle(colors.muted); if !item.record.text("location").isEmpty { Label(item.record.text("location"), systemImage: "mappin").font(.appCaption).foregroundStyle(colors.muted) }; if !item.record.text("zone").isEmpty && item.record.text("zone") != TimeZone.current.identifier { Text(item.record.text("zone")).font(.appMicro).foregroundStyle(colors.muted) } }.frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.appMicro).foregroundStyle(.tertiary).padding(.top, 5)
            }.padding(.vertical, 5).fixedSize(horizontal: false, vertical: true)
        }.buttonStyle(.plain)
    }
}

private struct RecordDetailOrApplication: View {
    @Environment(\.ascendColors) private var colors
    var item: AgendaItem
    var body: some View { if item.collection == "applications" { ApplicationDetail(id: item.recordID) } else { RecordDetail(collection: item.collection, id: item.recordID) } }
}
