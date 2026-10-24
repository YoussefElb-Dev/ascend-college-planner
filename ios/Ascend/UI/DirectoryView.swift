import SwiftUI

struct CampusPhoto: View {
    @Environment(\.ascendColors) private var colors
    @ObservedObject private var directory = CollegeDirectory.shared
    var college: Entry
    var height: CGFloat = 130
    private var photo: Entry { Entry(directory.media[college.id]?.fields["photo"]?.object ?? [:]) }
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [colors.mint, colors.lavender], startPoint: .topLeading, endPoint: .bottomTrailing)
            if let url = URL(string: photo.text("url")), ["upload.wikimedia.org", "thumb.wikimedia.org"].contains(url.host ?? "") {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { placeholder }.frame(maxWidth: .infinity).frame(height: height).clipped()
            } else { placeholder }
        }.frame(height: height).clipShape(RoundedRectangle(cornerRadius: 12)).saturation(colors.monochrome ? 0 : 1).accessibilityLabel(college.title + " campus")
    }
    private var placeholder: some View { VStack(alignment: .leading, spacing: 8) { Image(systemName: "building.columns").font(.appTitle).opacity(0.5); Text(college.text("city") + ", " + college.text("state")).font(.appCaption.weight(.medium)); Text("Campus photo unavailable").font(.appMicro).foregroundStyle(colors.muted) }.padding(20).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading) }
}

struct DirectoryView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @ObservedObject private var directory = CollegeDirectory.shared
    var search: String
    @State private var onlySaved = false
    @State private var limit = 24
    private let featured = ["186131", "243744", "166683", "131520", "170976", "104151", "110662", "164465", "139755", "236948", "199120", "243780"]
    private var results: [Entry] {
        let favorites = store.workspace.root["favorites"]?.array.map(\.text) ?? []
        let all = store.workspace.records("customColleges") + directory.colleges
        if search.isEmpty && !onlySaved { return featured.compactMap { id in all.first { $0.id == id } } }
        return all.filter { (!onlySaved || favorites.contains($0.id)) && (search.isEmpty || ($0.title + " " + $0.text("city") + " " + $0.text("state")).localizedCaseInsensitiveContains(search)) }
    }
    var body: some View {
        SectionHeading(title: "Find your place", subtitle: "\(directory.colleges.count.formatted()) colleges · Public NCES & College Scorecard data")
        Toggle("Saved colleges only", isOn: $onlySaved).font(.appBody)
        if results.isEmpty { EmptyCard(icon: "magnifyingglass", title: "No matching colleges", message: "Try a school name, city, or state abbreviation.") }
        ForEach(Array(results.prefix(limit))) { c in
            NavigationLink { CollegeDetail(college: c) } label: {
                VStack(alignment: .leading, spacing: 8) {
                    CampusPhoto(college: c)
                    Text(c.title).font(.appHeadline).foregroundStyle(colors.text)
                    Text(c.text("city") + ", " + c.text("state") + " · " + c.text("type")).font(.appCaption).foregroundStyle(colors.muted)
                    Text(directory.description(c)).font(.appBody).foregroundStyle(colors.muted).lineLimit(3)
                    HStack { Text("Tuition & fees · 2025–26").font(.appMicro).foregroundStyle(colors.muted); Spacer(); Text(currency(c.fields["tuitionOut"] ?? c.fields["tuitionIn"])).font(.appBody.weight(.semibold)).foregroundStyle(colors.text) }
                }.padding(12).background(colors.surface, in: RoundedRectangle(cornerRadius: 16)).overlay { RoundedRectangle(cornerRadius: 16).stroke(colors.border, lineWidth: 0.7) }
            }.buttonStyle(.plain)
        }
        if results.count > limit { Button("Show more colleges") { limit += 24 }.frame(maxWidth: .infinity).buttonStyle(.bordered) }
        Text("Tuition excludes living expenses and aid. Figures are historical reporting snapshots; verify current costs with the college.").font(.appCaption).foregroundStyle(colors.muted)
    }
}

func currency(_ value: JSONValue?) -> String { guard let value, value != .null, !value.text.isEmpty else { return "Not reported" }; return value.number.formatted(.currency(code: "USD").precision(.fractionLength(0))) }

struct CollegeDetail: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    @ObservedObject private var directory = CollegeDirectory.shared
    var college: Entry
    @State private var expanded = false
    @State private var edit: EditTarget?
    @State private var added = false
    private var media: Entry { directory.media[college.id] ?? Entry() }
    private var saved: Bool { store.workspace.root["favorites"]?.array.contains(.string(college.id)) ?? false }
    private var compared: Bool { store.workspace.root["compare"]?.array.contains(.string(college.id)) ?? false }
    var body: some View {
        Page {
            CampusPhoto(college: college, height: 165)
            SectionHeading(title: college.title, subtitle: college.text("city") + ", " + college.text("state") + " · " + college.text("type"))
            HStack {
                Button { toggle("favorites") } label: { Label(saved ? "Saved" : "Save", systemImage: saved ? "heart.fill" : "heart") }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                Button { toggle("compare") } label: { Label(compared ? "Comparing" : "Compare", systemImage: "rectangle.split.2x1") }.buttonStyle(.bordered).buttonBorderShape(.capsule)
            }
            Panel {
                SectionHeading(title: "About the college")
                Text(directory.description(college)).font(.appBody).foregroundStyle(colors.muted).lineLimit(expanded ? nil : 5).textSelection(.enabled)
                Button(expanded ? "Read less" : "Read more") { expanded.toggle() }.font(.appBody.weight(.medium))
                if !media.text("article").isEmpty { SafeLink(title: "Wikipedia · CC BY-SA 4.0", address: media.text("article")).font(.appCaption) }
                else { Text("Description based on NCES/IPEDS directory data.").font(.appCaption).foregroundStyle(colors.muted) }
            }
            Panel {
                SectionHeading(title: "The numbers", subtitle: "Public reporting, with context")
                fact("In-state tuition & fees", currency(college.fields["tuitionIn"]), note: "Academic year 2025–26")
                fact("Out-of-state tuition & fees", currency(college.fields["tuitionOut"]), note: "Academic year 2025–26")
                fact("Undergraduate enrollment", college.fields["enrollment"].map { Int($0.number).formatted() } ?? "Not reported", note: "Fall 2024 · Degree/certificate seeking")
                fact("Admission rate", college.fields["admissionRate"].map { $0.number.formatted(.percent.precision(.fractionLength(1))) } ?? "Not reported", note: "Fall 2024 · Historical, not personal odds")
                fact("Graduation rate", college.fields["graduationRate"].map { $0.number.formatted(.percent.precision(.fractionLength(1))) } ?? "Not reported", note: "150% of normal time · First-time, full-time cohort")
                Text("Living costs and aid are excluded. Graduation cohorts differ by institution. Verify current prices and requirements with the college.").font(.appCaption).foregroundStyle(colors.muted)
            }
            Panel {
                SectionHeading(title: "Useful links")
                SafeLink(title: "College website", address: college.text("url")); SafeLink(title: "Admissions", address: college.text("admissionsUrl")); SafeLink(title: "Financial aid", address: college.text("financialAidUrl")); SafeLink(title: "Net price calculator", address: college.text("netPriceCalculatorUrl"))
            }
            let existing = store.workspace.records("applications").first { $0.text("collegeId") == college.id }
            if let existing { NavigationLink { ApplicationDetail(id: existing.id) } label: { Text("View your application").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent).buttonBorderShape(.capsule) }
            else { Button { var a = RecordSpec.new("applications"); a.set("name", college.title); a.set("collegeId", college.id); a.set("url", college.text("applicationUrl")); a.set("major", store.workspace.profile.text("major")); edit = EditTarget("applications", a) } label: { Label("Add to my applications", systemImage: "plus").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).foregroundStyle(colors.onAccent).buttonBorderShape(.capsule) }
            let photo = Entry(media.fields["photo"]?.object ?? [:])
            if !photo.text("page").isEmpty { VStack(alignment: .leading, spacing: 6) { SafeLink(title: "Photo: " + (photo.text("artist").isEmpty ? "Wikimedia Commons" : photo.text("artist")), address: photo.text("page")); SafeLink(title: photo.text("license"), address: photo.text("licenseUrl")) }.font(.appCaption) }
            Text("Directory: NCES IPEDS 2025–26. Statistics: College Scorecard, October 15, 2026 release, with mixed reporting years.").font(.appCaption).foregroundStyle(colors.muted)
        }.navigationTitle("College profile").navigationBarTitleDisplayMode(.inline).task { await directory.loadMedia(college) }.sheet(item: $edit) { EntryEditor($0) }
    }
    private func fact(_ label: String, _ value: String, note: String) -> some View { VStack(alignment: .leading, spacing: 5) { HStack(alignment: .firstTextBaseline) { Text(label).font(.appBody); Spacer(); Text(value).font(.appBody.weight(.semibold)) }; Text(note).font(.appMicro).foregroundStyle(colors.muted) }.padding(.vertical, 4) }
    private func toggle(_ key: String) { store.change { w in var values = w.root[key]?.array ?? []; if let i = values.firstIndex(of: .string(college.id)) { values.remove(at: i) } else { values.append(.string(college.id)) }; w.root[key] = .array(values) } }
}

struct ComparisonView: View {
    @Environment(\.ascendColors) private var colors
    @EnvironmentObject var store: WorkspaceStore
    var body: some View {
        Page {
            SectionHeading(title: "Compare your options", subtitle: "Saved for comparison in Ascend")
            let colleges = (store.workspace.root["compare"]?.array ?? []).compactMap { CollegeDirectory.shared.record($0.text, workspace: store.workspace) }
            if colleges.isEmpty { EmptyCard(icon: "rectangle.split.2x1", title: "Start with a few schools", message: "Choose Compare on a college profile to add it here.") }
            ForEach(colleges) { c in Panel { NavigationLink { CollegeDetail(college: c) } label: { Text(c.title).font(.appHeadline) }; Text(c.text("city") + ", " + c.text("state")).font(.appBody).foregroundStyle(colors.muted); LabeledContent("Tuition & fees", value: currency(c.fields["tuitionOut"])); LabeledContent("Admission rate", value: c.fields["admissionRate"].map { $0.number.formatted(.percent.precision(.fractionLength(1))) } ?? "Not reported"); LabeledContent("Undergraduates", value: c.fields["enrollment"].map { Int($0.number).formatted() } ?? "Not reported") }.font(.appBody) }
        }.navigationTitle("Compare")
    }
}
