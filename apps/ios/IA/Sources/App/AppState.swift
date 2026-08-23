import Foundation
import Observation

/// Root application state: auth phase machine owning the Better Auth client
/// and the Convex sync client, including JWT refresh scheduling.
@MainActor
@Observable
public final class AppState {
    public enum Phase: Equatable {
        case booting
        case loggedOut
        case signedIn
    }

    public private(set) var phase: Phase = .booting
    public private(set) var connectionStatus: ConvexSyncClient.Status = .disconnected(reason: "Idle")
    public private(set) var currentUser: ClubUser?

    @ObservationIgnored private var auth: BetterAuthClient?
    @ObservationIgnored private var sync: ConvexSyncClient?
    @ObservationIgnored private var config = BackendConfig.fromEnvironment()
    @ObservationIgnored private var tokenRefreshTask: Task<Void, Never>?
    @ObservationIgnored private var latestConvexToken: String?
    @ObservationIgnored private var bootstrapped = false

    public init() {}

    // MARK: Bootstrap

    public func bootstrapIfNeeded() async {
        guard !self.bootstrapped else { return }
        self.bootstrapped = true
        let client = BetterAuthClient(siteURL: config.siteURL)
        self.auth = client
        do {
            guard let payload = try await client.currentSession(forceNetwork: true),
                  payload.objectValue?["session"]?.objectValue != nil
            else {
                self.phase = .loggedOut
                return
            }
            self.currentUser = Self.extractUser(from: payload)
            await self.beginSync()
            self.phase = .signedIn
        } catch {
            // Network/auth failure at launch lands on the login screen.
            self.phase = .loggedOut
        }
    }

    // MARK: Auth actions

    public func signIn(username: String, password: String) async throws {
        guard let client = auth else { return }
        let payload = try await client.signIn(username: username, password: password)
        guard payload.objectValue?["user"] != nil ||
            payload.objectValue?["token"] != nil
        else {
            throw BetterAuthError.missingField("user")
        }
        // Confirm the HTTP layer agrees before flipping phases.
        guard let session = try await client.currentSession(forceNetwork: true),
              session.objectValue?["session"]?.objectValue != nil
        else {
            throw BetterAuthError.http(status: 401, message: "Session could not be established")
        }
        self.currentUser = Self.extractUser(from: session)
        await self.beginSync()
        self.phase = .signedIn
    }

    public func signOut() async {
        self.tokenRefreshTask?.cancel()
        self.tokenRefreshTask = nil
        if let sync {
            await sync.shutdown()
        }
        sync = nil
        self.latestConvexToken = nil
        try? await self.auth?.signOut()
        self.currentUser = nil
        self.phase = .loggedOut
    }

    // MARK: Sync lifecycle

    private func beginSync() async {
        guard self.sync == nil else { return }
        let client = ConvexSyncClient(backendURL: config.convexURL) { [weak self] status in
            Task { @MainActor in
                self?.connectionStatus = status
                if case .authFailed = status {
                    self?.phase = .loggedOut
                }
            }
        }
        self.sync = client
        let authClient = self.auth
        await client.start(tokenProvider: { force in
            guard let authClient else { return nil }
            return try? await authClient.convexToken(forceRefresh: force)
        })
        if self.latestConvexToken == nil {
            self.latestConvexToken = try? await authClient?.convexToken(forceRefresh: false)
        }
        self.scheduleTokenRefresh()
    }

    private func scheduleTokenRefresh() {
        self.tokenRefreshTask?.cancel()
        guard let token = latestConvexToken,
              let expiration = JWTHelpers.expiration(token)
        else {
            // Unknown expiry: conservative fixed-interval refresh.
            self.tokenRefreshTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(45 * 60))
                await self?.refreshTokenNow(force: true)
            }
            return
        }
        let refreshAt = max(expiration.addingTimeInterval(-10), Date().addingTimeInterval(5))
        self.tokenRefreshTask = Task { [weak self] in
            let interval = refreshAt.timeIntervalSinceNow
            try? await Task.sleep(for: .seconds(max(interval, 1)))
            await self?.refreshTokenNow(force: true)
        }
    }

    private func refreshTokenNow(force: Bool) async {
        do {
            let fresh = try await auth?.convexToken(forceRefresh: force)
            self.latestConvexToken = fresh
            if let fresh, let sync {
                await sync.setAuthToken(fresh)
            }
            self.scheduleTokenRefresh()
        } catch {
            // Leave the current token; AuthError handling covers hard failures.
        }
    }

    public func syncClient() -> ConvexSyncClient? {
        self.sync
    }

    // MARK: Helpers

    static func extractUser(from sessionPayload: ConvexJSON) -> ClubUser? {
        guard let user = sessionPayload["user"] else { return nil }
        let uniqueId = user.optionalString("username")
            ?? user.optionalString("displayUsername")
            ?? ""
        return ClubUser(
            id: user.optionalString("id") ?? "",
            uniqueId: uniqueId.uppercased(),
            firstName: user.optionalString("name") ?? "",
            lastName: "",
            avatarUrl: user.optionalString("image")
        )
    }
}
