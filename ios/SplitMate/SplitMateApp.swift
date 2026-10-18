import SwiftUI

@main
struct SplitMateApp: App {
    @State private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .preferredColorScheme(.dark)
                .tint(Theme.sky)
        }
    }
}

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch store.session {
            case .loading:
                ZStack {
                    AppBackground()
                    ProgressView()
                }
            case .signedOut:
                AuthView()
            case .guest, .signedIn:
                MainTabView()
            }
        }
        .animation(.default, value: store.session)
        .task { await store.start() }
        .onChange(of: scenePhase) { _, phase in
            // Pick up changes your partner made while the app was in the background.
            if phase == .active { Task { await store.refresh() } }
        }
        .alert("SplitMate", isPresented: Binding(get: { store.errorMessage != nil },
                                                 set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
    }
}

struct MainTabView: View {
    enum Tab: Hashable { case split, history, cards, settings }

    @Environment(AppStore.self) private var store
    @State private var selection: Tab = .split

    var body: some View {
        TabView(selection: $selection) {
            SwiftUI.Tab("Split", systemImage: "plus.circle.fill", value: .split) {
                SplitView()
            }
            SwiftUI.Tab("History", systemImage: "list.bullet.rectangle.portrait", value: .history) {
                HistoryView()
            }
            .badge(store.unpaid.count)
            SwiftUI.Tab("Cards", systemImage: "creditcard", value: .cards) {
                CardsView()
            }
            SwiftUI.Tab("Settings", systemImage: "gearshape", value: .settings) {
                SettingsView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}
