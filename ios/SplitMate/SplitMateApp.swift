import SwiftUI

/// Native iOS shell for SplitMate. The app itself (auth, sync, receipt
/// scanning) lives on the server, so this loads it full-screen in a WebView.
@main
struct SplitMateApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}

enum AppConfig {
    static let startURL = URL(string: "https://split-mate.replit.app/app")!
    static let background = Color(red: 7 / 255, green: 7 / 255, blue: 26 / 255) // #07071a
}

struct ContentView: View {
    @State private var loadFailed = false
    @State private var reloadToken = 0

    var body: some View {
        ZStack {
            AppConfig.background.ignoresSafeArea()

            WebView(url: AppConfig.startURL, loadFailed: $loadFailed, reloadToken: reloadToken)
                .ignoresSafeArea()

            if loadFailed {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 44))
                        .foregroundStyle(.secondary)
                    Text("Can't reach SplitMate")
                        .font(.headline)
                    Text("Check your connection and try again.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Try Again") {
                        loadFailed = false
                        reloadToken += 1
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppConfig.background)
            }
        }
    }
}
