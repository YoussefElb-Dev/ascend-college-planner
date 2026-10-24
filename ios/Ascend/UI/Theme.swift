import SwiftUI

enum Palette {
    static let accent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.77, green: 0.73, blue: 0.96, alpha: 1)
            : UIColor(red: 0.36, green: 0.32, blue: 0.62, alpha: 1)
    })
    static let lavender = Color(red: 0.82, green: 0.80, blue: 0.94)
    static let mint = Color(red: 0.77, green: 0.88, blue: 0.84)
    static let peach = Color(red: 0.96, green: 0.85, blue: 0.77)
    static let ink = Color.primary
}

struct PageBackground: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color(uiColor: .systemGroupedBackground)
            LinearGradient(colors: [Palette.lavender.opacity(scheme == .dark ? 0.17 : 0.48), Palette.mint.opacity(scheme == .dark ? 0.07 : 0.22), Color.clear], startPoint: .topLeading, endPoint: .bottomTrailing)
        }.ignoresSafeArea()
    }
}

struct Page<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View { ZStack { PageBackground(); ScrollView { VStack(alignment: .leading, spacing: 24) { content }.padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 28).frame(maxWidth: 760) }.scrollIndicators(.hidden) } }
}

struct GlassSurface: ViewModifier {
    var radius: CGFloat = 24
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder func body(content: Content) -> some View {
        if reduceTransparency { content.background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: radius)) }
        else if #available(iOS 26.0, *) { content.glassEffect(.regular, in: .rect(cornerRadius: radius)) }
        else { content.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius)).overlay { RoundedRectangle(cornerRadius: radius).stroke(.white.opacity(0.55), lineWidth: 0.7) } }
    }
}
extension View { func glassPanel(_ radius: CGFloat = 24) -> some View { modifier(GlassSurface(radius: radius)) } }

struct Panel<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View { VStack(alignment: .leading, spacing: 16) { content }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(Color(uiColor: .secondarySystemGroupedBackground).opacity(0.86), in: RoundedRectangle(cornerRadius: 24)).overlay { RoundedRectangle(cornerRadius: 24).stroke(.primary.opacity(0.045), lineWidth: 1) } }
}

struct SectionHeading: View {
    var title: String
    var subtitle: String = ""
    var body: some View { VStack(alignment: .leading, spacing: 5) { Text(title).font(.title3.weight(.semibold)); if !subtitle.isEmpty { Text(subtitle).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) } } }
}

struct EmptyCard: View {
    var icon: String = "sparkles"
    var title: String
    var message: String
    var body: some View { Panel { Image(systemName: icon).font(.title2).foregroundStyle(Palette.accent); Text(title).font(.headline); Text(message).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true) } }
}

struct StatusPill: View {
    var text: String
    var body: some View { Text(text.isEmpty ? "Not set" : text).font(.caption.weight(.medium)).padding(.horizontal, 10).padding(.vertical, 6).background(Palette.accent.opacity(0.10), in: Capsule()).foregroundStyle(.primary) }
}

struct CheckButton: View {
    var done: Bool
    var label: String
    var action: () -> Void
    var body: some View { Button(action: action) { Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(done ? Palette.accent : Color.secondary).frame(width: 44, height: 44) }.buttonStyle(.plain).accessibilityLabel((done ? "Reopen " : "Complete ") + label) }
}

struct SafeLink: View {
    var title: String
    var address: String
    var body: some View { if let url = URL(string: address), ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil { Link(destination: url) { Label(title, systemImage: "arrow.up.right").font(.subheadline.weight(.medium)) } } }
}

struct DateField: View {
    var title: String
    @Binding var value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(title, isOn: Binding(get: { !value.isEmpty }, set: { value = $0 ? DateKey.today : "" }))
            if !value.isEmpty { DatePicker(title, selection: Binding(get: { DateKey.date(value) ?? Date() }, set: { value = DateKey.string($0) }), displayedComponents: .date).labelsHidden() }
        }
    }
}

struct TimeField: View {
    var title: String
    @Binding var value: String
    var required = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !required { Toggle(title, isOn: Binding(get: { !value.isEmpty }, set: { value = $0 ? "09:00" : "" })) }
            if required || !value.isEmpty {
                DatePicker(title, selection: Binding(get: {
                    let parts = value.split(separator: ":").compactMap { Int($0) }
                    return DateKey.calendar.date(bySettingHour: parts.first ?? 9, minute: parts.count > 1 ? parts[1] : 0, second: 0, of: Date()) ?? Date()
                }, set: { date in
                    let parts = DateKey.calendar.dateComponents([.hour, .minute], from: date); value = String(format: "%02d:%02d", parts.hour!, parts.minute!)
                }), displayedComponents: .hourAndMinute).datePickerStyle(.compact)
            }
        }
    }
}

enum AppOptions {
    static let statuses = ["Considering", "Not Started", "In Progress", "Ready to Submit", "Submitted", "Awaiting Decision", "Accepted", "Waitlisted", "Rejected", "Withdrawn"]
    static let rounds = ["Regular Decision", "Early Action", "Early Decision", "Early Decision II", "Restrictive Early Action", "QuestBridge Match", "Rolling Admission", "Transfer", "Custom"]
}
