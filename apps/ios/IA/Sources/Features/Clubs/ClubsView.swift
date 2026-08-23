import SwiftUI

// MARK: - Club directory

/// Typed navigation routes; two levels of String destinations would collide
/// inside one NavigationStack (SwiftUI honors one destination per type).
enum ClubRoute: Hashable {
    case workspace(clubId: String)
    case channel(channelId: String)
}

struct ClubsView: View {
    @Environment(AppState.self) private var appState
    @State private var clubs: [ClubSummaryModel] = []
    @State private var loadFailure: String?

    var body: some View {
        NavigationStack {
            Group {
                if self.clubs.isEmpty, self.loadFailure == nil {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if self.clubs.isEmpty {
                    ContentUnavailableView(
                        "No clubs",
                        systemImage: "person.3",
                        description: Text(self.loadFailure ?? "You are not a member of any clubs yet.")
                    )
                } else {
                    List(self.clubs) { club in
                        NavigationLink(value: ClubRoute.workspace(clubId: club.id)) {
                            ClubRowView(club: club)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Clubs")
            .navigationDestination(for: ClubRoute.self) { route in
                switch route {
                case .workspace(let clubId):
                    ClubWorkspaceView(clubId: clubId)
                case .channel:
                    EmptyView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await self.appState.signOut() }
                    } label: {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                    }
                    .accessibilityLabel("Sign out")
                }
            }
        }
        .task {
            guard let client = appState.syncClient() else { return }
            let stream = client.subscribe(path: "clubs/management:getAll", argsObject: [:])
            for await update in stream {
                if update.failure == nil, let value = update.value {
                    self.clubs = value.arrayValue?.compactMap { try? ClubSummaryModel(json: $0) } ?? []
                } else if let failure = update.failure {
                    self.loadFailure = failure
                }
            }
        }
    }
}

struct ClubRowView: View {
    let club: ClubSummaryModel

    var body: some View {
        HStack(spacing: 12) {
            self.initialsBadge
            VStack(alignment: .leading, spacing: 2) {
                Text(self.club.name)
                    .font(.body.weight(.medium))
                HStack(spacing: 4) {
                    if let role = club.viewerRole, !role.isEmpty {
                        Text(role)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(.tint.opacity(0.15), in: Capsule())
                    }
                    Text("\(self.club.memberCount) members · \(self.club.channelCount) channels")
                        .foregroundStyle(.secondary)
                }
                .font(.caption)
            }
        }
        .padding(.vertical, 2)
    }

    private var initialsBadge: some View {
        let initials = self.club.name
            .split(separator: " ")
            .compactMap(\.first)
            .prefix(2)
        return Text(String(initials))
            .font(.callout.weight(.semibold))
            .frame(width: 40, height: 40)
            .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Workspace channels

struct ClubWorkspaceView: View {
    let clubId: String

    @Environment(AppState.self) private var appState
    @State private var navigation: WorkspaceNavigation?
    @State private var loadFailure: String?

    var body: some View {
        Group {
            if let navigation {
                List(navigation.channels) { channel in
                    NavigationLink(value: ClubRoute.channel(channelId: channel.id)) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 5) {
                                Image(systemName: self.iconName(channel.visibility))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(channel.name)
                            }
                            if let description = channel.description, !description.isEmpty {
                                Text(description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                .listStyle(.plain)
            } else if self.loadFailure == nil {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ContentUnavailableView(
                    "Workspace unavailable",
                    systemImage: "lock",
                    description: Text(self.loadFailure ?? "")
                )
            }
        }
        .navigationTitle(self.navigation?.clubName ?? "Workspace")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: ClubRoute.self) { route in
            switch route {
            case .channel(let channelId):
                ChannelScreen(
                    clubId: self.clubId,
                    channelId: channelId,
                    channelNameFallback: self.navigation?.channels.first { $0.id == channelId }?.name ?? "Channel"
                )
            case .workspace:
                EmptyView()
            }
        }
        .task {
            guard let client = appState.syncClient() else { return }
            let stream = client.subscribe(
                path: "clubs/detail:getWorkspaceNavigation",
                argsObject: ["clubId": .string(self.clubId)]
            )
            for await update in stream {
                if update.failure == nil, let value = update.value {
                    if value.isNull {
                        self.loadFailure = self.loadFailure ?? "You do not have access to this club."
                        self.navigation = nil
                    } else {
                        self.navigation = try? WorkspaceNavigation(json: value)
                        self.loadFailure = nil
                    }
                } else if let failure = update.failure, navigation == nil {
                    self.loadFailure = failure
                }
            }
        }
    }

    private func iconName(_ visibility: String) -> String {
        switch visibility {
        case "PUBLIC": "number"
        case "MEMBER_READONLY": "eye"
        default: "lock"
        }
    }
}
