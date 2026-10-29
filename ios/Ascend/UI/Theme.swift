import SwiftUI

extension Color {
    init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}

// Keep the native palette aligned with dist/fluid.css.
struct AscendColors {
    var background = Color(hex: 0xf3f2f8)
    var surface = Color.white
    var solid = Color.white
    var text = Color(hex: 0x292c43)
    var muted = Color(hex: 0x6d7087)
    var border = Color(hex: 0xdedde9)
    var edge = Color.white.opacity(0.82)
    var accent = Color(hex: 0x7161bc)
    var onAccent = Color.white
    var lavender = Color(hex: 0xeae4f6)
    var mint = Color(hex: 0xe3eee8)
    var peach = Color(hex: 0xf7eadd)
    var blue = Color(hex: 0xeae5f9)
    var hero = [Color(hex: 0xedcfc4), Color(hex: 0xead3de), Color(hex: 0xd9ccea)]
    var dark = false
    var monochrome = false

    static func resolve(_ mode: String, scheme: ColorScheme) -> Self {
        var c = Self()
        if mode == "monochrome" {
            c.monochrome = true
            c.background = Color(hex: 0xe9e9e9); c.solid = Color(hex: 0xfafafa)
            c.text = Color(hex: 0x202020); c.muted = Color(hex: 0x5d5d5d)
            c.border = Color.black.opacity(0.16); c.accent = Color(hex: 0x323232)
            c.lavender = Color(hex: 0xdedede); c.mint = Color(hex: 0xe3e3e3)
            c.peach = Color(hex: 0xededed); c.blue = Color(hex: 0xe2e2e2)
            c.hero = [Color(hex: 0xdedede), Color(hex: 0xe7e7e7), Color(hex: 0xdedede)]
        } else if mode == "dark" || (mode == "system" && scheme == .dark) {
            c.dark = true
            c.background = Color(hex: 0x191b29); c.surface = Color(hex: 0x252839)
            c.solid = Color(hex: 0x252839); c.text = Color(hex: 0xf0edf7)
            c.muted = Color(hex: 0xb0abc5); c.border = Color(hex: 0x3d3c53)
            c.edge = Color.white.opacity(0.17); c.accent = Color(hex: 0xc1b0f1)
            c.onAccent = Color(hex: 0x241f34)
            c.lavender = Color(hex: 0x38324e); c.mint = Color(hex: 0x2b423d)
            c.peach = Color(hex: 0x493c33); c.blue = Color(hex: 0x3b3455)
            c.hero = [Color(hex: 0x524457), Color(hex: 0x304b43)]
        }
        return c
    }
}

private struct AscendColorsKey: EnvironmentKey { static let defaultValue = AscendColors() }
extension EnvironmentValues {
    var ascendColors: AscendColors { get { self[AscendColorsKey.self] } set { self[AscendColorsKey.self] = newValue } }
}

// The same locally bundled variable font as the website; custom fonts retain Dynamic Type.
extension Font {
    static let appBody = Font.custom("PlusJakartaSans-Regular", size: 14, relativeTo: .body)
    static let appHeadline = Font.custom("PlusJakartaSans-Regular", size: 15, relativeTo: .headline).weight(.semibold)
    static let appCaption = Font.custom("PlusJakartaSans-Regular", size: 12, relativeTo: .caption)
    static let appMicro = Font.custom("PlusJakartaSans-Regular", size: 11, relativeTo: .caption2)
    static let appSection = Font.custom("PlusJakartaSans-Regular", size: 17, relativeTo: .title3).weight(.semibold)
    static let appTitle = Font.custom("PlusJakartaSans-Regular", size: 23, relativeTo: .title2).weight(.semibold)
}

struct PageBackground: View {
    @Environment(\.ascendColors) private var colors
    var body: some View {
        ZStack { colors.background; RadialGradient(colors: [colors.lavender.opacity(0.8), .clear], center: .topLeading, startRadius: 0, endRadius: 560); RadialGradient(colors: [colors.mint.opacity(0.65), .clear], center: .bottomTrailing, startRadius: 0, endRadius: 480) }.ignoresSafeArea()
    }
}

struct Page<Content: View>: View {
    @Environment(\.ascendColors) private var colors
    @ViewBuilder var content: Content
    var body: some View { ZStack { PageBackground(); ScrollView { VStack(alignment: .leading, spacing: 12) { content }.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 20).frame(maxWidth: 760) }.scrollIndicators(.hidden) } }
}

struct GlassSurface: ViewModifier {
    var radius: CGFloat = 24
    @Environment(\.ascendColors) private var colors
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder func body(content: Content) -> some View {
        content.background(reduceTransparency ? AnyShapeStyle(colors.solid) : AnyShapeStyle(.ultraThinMaterial), in: RoundedRectangle(cornerRadius: radius, style: .continuous)).overlay { RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(colors.border.opacity(0.8), lineWidth: 0.7) }
    }
}
extension View { func glassPanel(_ radius: CGFloat = 24) -> some View { modifier(GlassSurface(radius: radius)) } }

struct Panel<Content: View>: View {
    @Environment(\.ascendColors) private var colors
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder var content: Content
    var body: some View { VStack(alignment: .leading, spacing: 10) { content }.padding(16).frame(maxWidth: .infinity, alignment: .leading).glassPanel(26) }
}

struct SectionHeading: View {
    @Environment(\.ascendColors) private var colors
    var title: String
    var subtitle: String = ""
    var body: some View { VStack(alignment: .leading, spacing: 3) { Text(title).font(.appSection); if !subtitle.isEmpty { Text(subtitle).font(.appCaption).foregroundStyle(colors.muted).fixedSize(horizontal: false, vertical: true) } } }
}

struct EmptyCard: View {
    @Environment(\.ascendColors) private var colors
    var icon: String = "sparkles"
    var title: String
    var message: String
    var body: some View { Panel { HStack(alignment: .top, spacing: 12) { Image(systemName: icon).font(.appSection).foregroundStyle(colors.accent).frame(width: 24); VStack(alignment: .leading, spacing: 4) { Text(title).font(.appHeadline); Text(message).font(.appCaption).foregroundStyle(colors.muted).fixedSize(horizontal: false, vertical: true) } } } }
}

struct StatusPill: View {
    @Environment(\.ascendColors) private var colors
    var text: String
    var body: some View { Text(text.isEmpty ? "Not set" : text).font(.appMicro.weight(.medium)).padding(.horizontal, 8).padding(.vertical, 4).background(colors.lavender, in: Capsule()).foregroundStyle(colors.text) }
}

struct CheckButton: View {
    @Environment(\.ascendColors) private var colors
    var done: Bool
    var label: String
    var action: () -> Void
    var body: some View { Button(action: action) { Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.appSection).foregroundStyle(done ? colors.accent : colors.muted).frame(width: 44, height: 44) }.buttonStyle(.plain).accessibilityLabel((done ? "Reopen " : "Complete ") + label) }
}

struct SafeLink: View {
    @Environment(\.ascendColors) private var colors
    var title: String
    var address: String
    var body: some View { if let url = URL(string: address), ["https", "http"].contains(url.scheme?.lowercased() ?? ""), url.host != nil { Link(destination: url) { Label(title, systemImage: "arrow.up.right").font(.appBody.weight(.medium)) } } }
}

struct DateField: View {
    @Environment(\.ascendColors) private var colors
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
    @Environment(\.ascendColors) private var colors
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
