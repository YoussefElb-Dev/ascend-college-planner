import SwiftUI

@main struct AscendApp: App {
    @StateObject private var sync=DeviceSyncStore()
    @Environment(\.scenePhase) private var phase
    @StateObject private var store = WorkspaceStore(preview: ProcessInfo.processInfo.arguments.contains("--preview"))
    var body: some Scene {
        WindowGroup {
            ThemedRootView().environmentObject(store).environmentObject(sync)
                .task { sync.attach(store);while !Task.isCancelled {if phase == .active {await sync.sync()};try? await Task.sleep(nanoseconds:60_000_000_000)} }
                .onChange(of:store.lastSaved) {_,_ in sync.changed()}
                .onChange(of:phase) {_,value in sync.active=value == .active;if value == .active {Task{await sync.sync()}}}
                .preferredColorScheme(store.workspace.profile.text("theme") == "dark" ? .dark : store.workspace.profile.text("theme") == "system" ? nil : .light)
                .saturation(store.workspace.profile.text("theme") == "monochrome" ? 0 : 1)
                .alert("Ascend", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) { Button("OK") { store.error = nil } } message: { Text(store.error ?? "") }
        }
    }
}

private struct ThemedRootView: View {
    @EnvironmentObject var store: WorkspaceStore
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        let colors = AscendColors.resolve(store.workspace.profile.text("theme"), scheme: scheme)
        RootView().environment(\.ascendColors, colors).tint(colors.accent)
            .font(.appBody).foregroundStyle(colors.text)
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
