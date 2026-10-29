import SwiftUI

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
        }.padding(14).glassPanel(24)
    }
}
