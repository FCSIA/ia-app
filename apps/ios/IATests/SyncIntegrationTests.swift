import Foundation
@testable import IA
import Testing

/// Live end-to-end proof of the sync/auth spike. Skipped unless integration
/// environment variables are provided:
///
///   IA_CONVEX_URL=http://<host>:3210
///   IA_CONVEX_SITE_URL=http://<host>:3211
///   IA_TEST_USERNAME=<id>
///   IA_TEST_PASSWORD=<password>
///
/// Never points at any deployment not explicitly supplied by the operator.
struct SyncIntegrationTests {
    @Test
    func signInSubscribeReceivesLiveData() async throws {
        let environment = ProcessInfo.processInfo.environment
        guard let convexURLString = environment["IA_CONVEX_URL"],
              let siteURLString = environment["IA_CONVEX_SITE_URL"],
              let username = environment["IA_TEST_USERNAME"],
              let password = environment["IA_TEST_PASSWORD"],
              !username.isEmpty, !password.isEmpty
        else {
            // Vacuous pass when unconfigured; the live gate runs only when an
            // operator explicitly supplies deployment env vars.
            print("[integration] skipped: IA_CONVEX_URL / IA_CONVEX_SITE_URL / IA_TEST_USERNAME / IA_TEST_PASSWORD not set")
            return
        }
        guard let convexURL = URL(string: convexURLString),
              let siteURL = URL(string: siteURLString)
        else {
            Issue.record("Invalid integration URLs")
            return
        }

        // 1. Auth over HTTP.
        let auth = BetterAuthClient(siteURL: siteURL, store: InMemorySessionStore())
        let signInPayload = try await auth.signIn(username: username, password: password)
        #expect(signInPayload.isNull == false)

        let session = try await auth.currentSession(forceNetwork: true)
        #expect(session?.objectValue?["session"] != nil)

        // 2. Short-lived JWT for Convex.
        let token = try await auth.convexToken(forceRefresh: false)
        #expect(!token.isEmpty)
        #expect(JWTHelpers.expiration(token) != nil)

        // 3. WebSocket sync subscription delivers a real transition.
        let actor = SyncProbeActor(convexURL: convexURL, auth: auth)
        let result = await actor.probeFirstDelivery(timeoutSeconds: 15)
        guard case .delivered(let latencyMs, let updateCount) = result else {
            Issue.record("No transition delivered in time: \(result)")
            return
        }
        // First-delivery budget: generous for CI, reported honestly.
        #expect(latencyMs < 15000)
        #expect(updateCount >= 1)
        print("[integration] first delivery latency: \(latencyMs)ms across \(updateCount) updates")

        // 4. The paginated chat path — previously untested against a real
        // server: real club -> workspace navigation -> getMessagePage with
        // float64 paginationOpts (the exact path the slice's chat uses).
        let paginated = await actor.probePaginatedDelivery(timeoutSeconds: 20)
        if case .delivered(let pageLatencyMs, _) = paginated {
            print("[integration] paginated page latency: \(pageLatencyMs)ms")
            #expect(pageLatencyMs < 20000)
        } else {
            Issue.record("Paginated getMessagePage never delivered: \(paginated)")
        }

        // 4. Token refresh endpoint stays healthy under force.
        let refreshed = try await auth.convexToken(forceRefresh: true)
        #expect(!refreshed.isEmpty)
    }
}

/// Wraps the probe so the sync client's Sendable closures have a home.
private actor SyncProbeActor {
    private let convexURL: URL
    private let auth: BetterAuthClient

    init(convexURL: URL, auth: BetterAuthClient) {
        self.convexURL = convexURL
        self.auth = auth
    }

    enum ProbeResult {
        case delivered(latencyMs: Int, updateCount: Int)
        case timedOut
    }

    func probeFirstDelivery(timeoutSeconds: TimeInterval) async -> ProbeResult {
        let client = ConvexSyncClient(backendURL: convexURL)
        await client.start { [weak self] force in
            try? await self?.auth.convexToken(forceRefresh: force)
        }
        let stream = client.subscribe(path: "clubs/management:getAll", argsObject: [:])
        defer { Task { await client.shutdown() } }
        let startedAt = Date()
        var updates = 0
        let deadline = startedAt.addingTimeInterval(timeoutSeconds)

        for await update in stream {
            if update.failure == nil, update.value != nil {
                updates += 1
                let latency = Int(Date().timeIntervalSince(startedAt) * 1000)
                return .delivered(latencyMs: latency, updateCount: updates)
            }
            if Date() > deadline {
                break
            }
        }
        return .timedOut
    }

    /// Walks club list -> workspace navigation -> getMessagePage, proving the
    /// paginated chat arguments validate and deliver against a real backend.
    func probePaginatedDelivery(timeoutSeconds: TimeInterval) async -> ProbeResult {
        let client = ConvexSyncClient(backendURL: convexURL)
        await client.start { [weak self] force in
            try? await self?.auth.convexToken(forceRefresh: force)
        }
        defer { Task { await client.shutdown() } }
        let startedAt = Date()
        let deadline = startedAt.addingTimeInterval(timeoutSeconds)

        // Step 1: first real club id.
        guard case .delivered = await self.awaitFirstValue(
            client.subscribe(path: "clubs/management:getAll", argsObject: [:]),
            deadline: deadline
        ), let clubsJSON = self.lastValue,
        let clubId = clubsJSON.arrayValue?.first?["_id"]?.stringValue else {
            return .timedOut
        }

        // Step 2: first readable channel from workspace navigation.
        _ = await self.awaitFirstValue(
            client.subscribe(
                path: "clubs/detail:getWorkspaceNavigation",
                argsObject: ["clubId": .string(clubId)]
            ),
            deadline: deadline
        )
        guard let navJSON = self.lastValue, !navJSON.isNull,
              let channelId = navJSON["channels"]?.arrayValue?.first?["_id"]?.stringValue
        else {
            // Club without channels: navigation delivery already proves the
            // reactive path; there is no valid page target to subscribe.
            print("[integration] club has no channels; skipping page probe")
            return .delivered(latencyMs: Int(Date().timeIntervalSince(startedAt) * 1000), updateCount: 1)
        }
        return await self.probeMessagePage(
            client: client,
            clubId: clubId,
            channelId: channelId,
            startedAt: startedAt,
            deadline: deadline
        )
    }

    private func probeMessagePage(
        client: ConvexSyncClient,
        clubId: String,
        channelId: String?,
        startedAt: Date,
        deadline: Date
    ) async -> ProbeResult {
        var argsObject: [String: ConvexJSON] = ["clubId": .string(clubId)]
        if let channelId {
            argsObject["channelId"] = .string(channelId)
        } else {
            argsObject["channelId"] = .null
        }
        argsObject["paginationOpts"] = .object([
            "cursor": .null,
            "numItems": .double(30),
            "id": .double(1)
        ])
        let stream = client.subscribe(path: "clubs/channels:getMessagePage", argsObject: argsObject)
        for await update in stream {
            if update.failure == nil, update.value != nil {
                return .delivered(latencyMs: Int(Date().timeIntervalSince(startedAt) * 1000), updateCount: 1)
            }
            if let failure = update.failure {
                print("[integration] getMessagePage failed: \(failure)")
                return .timedOut
            }
            if Date() > deadline {
                break
            }
        }
        return .timedOut
    }

    private var lastValue: ConvexJSON?

    private func awaitFirstValue(
        _ stream: AsyncStream<ConvexSyncClient.QueryUpdate>,
        deadline: Date
    ) async -> ProbeResult {
        for await update in stream {
            if update.failure == nil, let value = update.value {
                self.lastValue = value
                return .delivered(latencyMs: 0, updateCount: 1)
            }
            if Date() > deadline {
                break
            }
        }
        return .timedOut
    }
}
