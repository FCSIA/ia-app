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
        // Endpoint transparency: the resolved targets should never be a
        // surprise, especially since defaults are loopback.
        print("[ia-ios] convex=\(self.config.convexURL.absoluteString) site=\(self.config.siteURL.absoluteString)")
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
        await self.teardownSync()
        try? await self.auth?.signOut()
        self.currentUser = nil
        self.phase = .loggedOut
    }

    /// Full sync teardown so the next sign-in builds a fresh, authenticated
    /// client instead of reusing a token-less zombie connection.
    private func teardownSync() async {
        if let sync {
            await sync.shutdown()
        }
        sync = nil
        self.latestConvexToken = nil
    }

    // MARK: Sync lifecycle

    private func beginSync() async {
        guard self.sync == nil else { return }
        let client = ConvexSyncClient(backendURL: config.convexURL) { [weak self] status in
            Task { @MainActor in
                self?.connectionStatus = status
                switch status {
                case .authFailed, .fatal:
                    // A dead or unauthorized connection must be rebuilt from
                    // scratch on the next sign-in.
                    await self?.teardownSync()
                    self?.phase = .loggedOut
                default:
                    break
                }
            }
        }
        self.sync = client
        let authClient = self.auth
        await client.start(tokenProvider: { [weak self] force in
            guard let authClient else { return nil }
            do {
                let token = try await authClient.convexToken(forceRefresh: force)
                await MainActor.run {
                    self?.latestConvexToken = token
                }
                return token
            } catch {
                return nil
            }
        })
        self.scheduleTokenRefresh()
    }

    private func scheduleTokenRefresh(afterFailure seconds: TimeInterval? = nil) {
        self.tokenRefreshTask?.cancel()
        if let seconds {
            self.tokenRefreshTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(seconds))
                await self?.refreshTokenNow(force: true)
            }
            return
        }
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
            // One transient blip must not kill the proactive refresh chain:
            // retry shortly; AuthError handling still covers hard failures.
            self.scheduleTokenRefresh(afterFailure: 30)
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
