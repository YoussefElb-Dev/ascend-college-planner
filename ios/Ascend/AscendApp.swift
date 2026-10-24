import SwiftUI

@main struct AscendApp: App {
    @StateObject private var store = WorkspaceStore(preview: ProcessInfo.processInfo.arguments.contains("--preview"))
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).tint(Palette.accent)
                .preferredColorScheme(store.workspace.profile.text("theme") == "dark" ? .dark : store.workspace.profile.text("theme") == "system" ? nil : .light)
                .saturation(store.workspace.profile.text("theme") == "monochrome" ? 0 : 1)
                .alert("Ascend", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK") { store.error = nil } } message: { Text(store.error ?? "") }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: WorkspaceStore
    var body: some View {
        TabView(selection: $store.tab) {
            NavigationStack { TodayView() }.tabItem { Label("Today", systemImage: "square.grid.2x2") }.tag(0)
            NavigationStack { ApplicationsView() }.tabItem { Label("Colleges", systemImage: "building.columns") }.tag(1)
            NavigationStack { PlannerView() }.tabItem { Label("Planner", systemImage: "calendar") }.tag(2)
            NavigationStack { WorkspaceView() }.tabItem { Label("Workspace", systemImage: "tray.full") }.tag(3)
        }
    }
}
