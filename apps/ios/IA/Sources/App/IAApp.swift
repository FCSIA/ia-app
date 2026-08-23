import SwiftUI

@main
struct IAApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(self.appState)
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        switch self.appState.phase {
        case .booting:
            VStack(spacing: 12) {
                Image(systemName: "graduationcap.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.tint)
                ProgressView()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .task { await self.appState.bootstrapIfNeeded() }
        case .loggedOut:
            LoginView()
        case .signedIn:
            ClubsView()
        }
    }
}
