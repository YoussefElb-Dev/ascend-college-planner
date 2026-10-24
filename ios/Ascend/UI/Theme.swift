import SwiftUI

extension Color {
    init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}

// Keep these values aligned with dist/studio.css, including its Liquid Glass overrides.
struct AscendColors {
    var background = Color(hex: 0xeeebf5)
    var surface = Color.white.opacity(0.67)
    var solid = Color.white
    var text = Color(hex: 0x303541)
    var muted = Color(hex: 0x68707b)
    var border = Color(hex: 0x5e4f72).opacity(0.13)
    var edge = Color.white.opacity(0.82)
    var accent = Color(hex: 0x574d66)
    var onAccent = Color.white
    var lavender = Color(hex: 0xe5dcf2)
    var mint = Color(hex: 0xe0eee5)
    var peach = Color(hex: 0xf5edda)
    var blue = Color(hex: 0xe3edf8)
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
            c.background = Color(hex: 0x211c2b); c.surface = Color(hex: 0x2e2838).opacity(0.72)
            c.solid = Color(hex: 0x302939); c.text = Color(hex: 0xf0e8f5)
            c.muted = Color(hex: 0xbaabc7); c.border = Color(hex: 0xdcd2ee).opacity(0.17)
            c.edge = Color.white.opacity(0.17); c.accent = Color(hex: 0xb9c6de)
            c.onAccent = Color(hex: 0x252334)
            c.lavender = Color(hex: 0x473757); c.mint = Color(hex: 0x2c463b)
            c.peach = Color(hex: 0x4d422e); c.blue = Color(hex: 0x2d4057)
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
        ZStack(alignment: .topLeading) {
            colors.background
            if !colors.monochrome {
                RadialGradient(colors: [Color(hex: colors.dark ? 0x675581 : 0xd9cce8).opacity(colors.dark ? 0.32 : 0.69), .clear], center: .topLeading, startRadius: 0, endRadius: 520)
                RadialGradient(colors: [Color(hex: colors.dark ? 0x3c675a : 0xe9cfc5).opacity(colors.dark ? 0.23 : 0.55), .clear], center: .topTrailing, startRadius: 0, endRadius: 420)
                RadialGradient(colors: [colors.mint.opacity(colors.dark ? 0.16 : 0.5), .clear], center: .bottom, startRadius: 0, endRadius: 500)
            }
        }.ignoresSafeArea()
    }
}

struct Page<Content: View>: View {
    @Environment(\.ascendColors) private var colors
    @ViewBuilder var content: Content
    var body: some View { ZStack { PageBackground(); ScrollView { VStack(alignment: .leading, spacing: 12) { content }.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 20).frame(maxWidth: 760) }.scrollIndicators(.hidden) } }
}

struct GlassSurface: ViewModifier {
    var radius: CGFloat = 16
    @Environment(\.ascendColors) private var colors
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder func body(content: Content) -> some View {
        if reduceTransparency { content.background(colors.solid, in: RoundedRectangle(cornerRadius: radius)).overlay { RoundedRectangle(cornerRadius: radius).stroke(colors.border, lineWidth: 0.7) } }
        else if #available(iOS 26.0, *) { content.glassEffect(.regular.tint(colors.surface), in: .rect(cornerRadius: radius)) }
        else { content.background(colors.surface, in: RoundedRectangle(cornerRadius: radius)).background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: radius)).overlay { RoundedRectangle(cornerRadius: radius).stroke(colors.edge, lineWidth: 0.7) } }
    }
}
extension View { func glassPanel(_ radius: CGFloat = 16) -> some View { modifier(GlassSurface(radius: radius)) } }

struct Panel<Content: View>: View {
    @Environment(\.ascendColors) private var colors
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder var content: Content
    var body: some View { VStack(alignment: .leading, spacing: 10) { content }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(reduceTransparency ? colors.solid : colors.surface, in: RoundedRectangle(cornerRadius: 16)).overlay { RoundedRectangle(cornerRadius: 16).stroke(colors.border, lineWidth: 0.7) } }
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
