import Dispatch
import Foundation

/// Minimal actor-based Convex WebSocket sync client (`convex@1.43.0` wire protocol).
///
/// Implements: Connect handshake, Authenticate (User JWT), reactive query
/// subscriptions with journal-carrying replay, mutation submission with
/// reconnect replay and read-your-writes, AuthError-driven token refresh,
/// server-inactivity watchdog, and jittered exponential backoff reconnects.
public actor ConvexSyncClient {
    public enum Status: Sendable, Equatable {
        case connecting
        case connected
        case disconnected(reason: String)
        case authFailed(String)
        case fatal(String)
    }

    public struct QueryUpdate: Sendable {
        public let value: ConvexJSON?
        public let failure: String?
    }

    public struct MutationOutcome: Sendable {
        public let success: Bool
        public let result: ConvexJSON?
        public let errorMessage: String?
    }

    public typealias TokenProvider = @Sendable (_ forceRefresh: Bool) async -> String?

    private static let protocolVersion = "1.43.0"
    private static let serverInactivitySeconds: TimeInterval = 60
    private static let maxBackoffSeconds: TimeInterval = 16

    // Connection state
    private let backendURL: URL
    private let sessionID = UUID().uuidString
    private let urlSession: URLSession
    private let statusHandler: @Sendable (Status) -> Void
    private var connectionCount = 0
    private var lastCloseReason: String? = "InitialConnect"
    private var socket: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var watchdogRunning = false
    private var retryCount = 0
    private var lastInboundAt = Date()
    private var stopped = false

    /// Protocol state
    private var currentVersion = StateVersion(querySet: 0, ts: 0, identity: 0)
    /// Auth base-version counter; resets to 0 on every fresh connection.
    private var authBaseCounter = 0
    private var authToken: String?
    private var authRefreshAttempts = 0
    private var maxObservedTimestamp: UInt64?

    // Queries
    private var nextQueryId = 0
    private var queries: [Int: QueryRecord] = [:]
    private var queryIdsByKey: [String: Int] = [:]

    // Mutations
    private var nextRequestId = 0
    private var pendingMutations: [Int: PendingMutation] = [:]
    private var committedTsByRequest: [Int: UInt64] = [:]
    /// Kept verbatim (same requestId) for reconnect replay until acknowledged.
    private var unacknowledgedMutations: [Int: SyncOutboundMessage] = [:]

    private var tokenProvider: TokenProvider?

    private var chunkBuffer = TransitionChunkBuffer()

    private struct QueryRecord {
        let path: String
        let argsArray: ConvexJSON
        var journal: String = ""
        var latest: ConvexJSON?
        var failure: String?
        var subscribers: [UUID: AsyncStream<QueryUpdate>.Continuation] = [:]

        var cacheKey: String {
            let encoded = (try? self.argsArray.encodedString()) ?? "?"
            return self.path + "|" + encoded
        }
    }

    private struct PendingMutation {
        let continuation: CheckedContinuation<MutationOutcome, Never>
    }

    public init(backendURL: URL, onStatus: @escaping @Sendable (Status) -> Void = { _ in }) {
        self.backendURL = backendURL
        self.statusHandler = onStatus
        let configuration = URLSessionConfiguration.default
        configuration.httpShouldSetCookies = false
        self.urlSession = URLSession(configuration: configuration)
    }

    // MARK: Lifecycle

    public func start(tokenProvider: TokenProvider?) async {
        guard !self.stopped else { return }
        self.tokenProvider = tokenProvider
        if self.authToken == nil, let provider = tokenProvider {
            self.authToken = await provider(false)
        }
        self.emit(.connecting)
        await self.openSocket()
    }

    public func shutdown() {
        self.stopped = true
        self.receiveTask?.cancel()
        self.socket?.cancel(with: .normalClosure, reason: nil)
        self.socket = nil
        self.failAllPendingMutations("Client shut down")
        self.finishAllStreams()
        self.emit(.disconnected(reason: "Shutdown"))
    }

    /// Pushes a fresh token; sends Authenticate live when connected.
    public func setAuthToken(_ token: String?) async {
        self.authToken = token
        self.authRefreshAttempts = 0
        guard self.socket != nil else { return }
        let baseVersion = self.authBaseCounter
        self.authBaseCounter += 1
        if let token {
            await self.safelySend(.authenticateUser(token: token, baseVersion: baseVersion))
        } else {
            await self.safelySend(.authenticateNone(baseVersion: baseVersion))
        }
    }

    // MARK: Queries

    public nonisolated func subscribe(path: String, argsObject: [String: ConvexJSON]) -> AsyncStream<QueryUpdate> {
        let argsArray = ConvexJSON.args(argsObject)
        let subscriberID = UUID()
        let key = QueryRecord(path: path, argsArray: argsArray).cacheKey
        return AsyncStream { continuation in
            Task {
                await self.attach(
                    key: key,
                    path: path,
                    argsArray: argsArray,
                    subscriberID: subscriberID,
                    continuation: continuation
                )
            }
            continuation.onTermination = { _ in
                Task { await self.detach(key: key, subscriberID: subscriberID) }
            }
        }
    }

    private func attach(
        key: String,
        path: String,
        argsArray: ConvexJSON,
        subscriberID: UUID,
        continuation: AsyncStream<QueryUpdate>.Continuation
    ) async {
        let queryId: Int
        if let existingId = queryIdsByKey[key] {
            queryId = existingId
        } else {
            queryId = self.nextQueryId
            self.nextQueryId += 1
            self.queries[queryId] = QueryRecord(path: path, argsArray: argsArray)
            self.queryIdsByKey[key] = queryId
            if self.socket != nil {
                let version = self.currentVersion.querySet
                let modification = QuerySetModification.add(
                    queryId: queryId,
                    udfPath: path,
                    args: argsArray,
                    journal: self.queries[queryId]?.journal
                )
                await self.safelySend(.modifyQuerySet(
                    baseVersion: version,
                    newVersion: version + 1,
                    modifications: [modification]
                ))
                self.currentVersion = StateVersion(
                    querySet: version + 1,
                    ts: self.currentVersion.ts,
                    identity: self.currentVersion.identity
                )
            }
        }
        self.queries[queryId]?.subscribers[subscriberID] = continuation
        if let record = queries[queryId] {
            continuation.yield(QueryUpdate(value: record.latest, failure: record.failure))
        }
    }

    private func detach(key: String, subscriberID: UUID) async {
        guard let queryId = queryIdsByKey[key], var record = queries[queryId] else { return }
        record.subscribers.removeValue(forKey: subscriberID)
        self.queries[queryId] = record
        guard record.subscribers.isEmpty else { return }
        self.queries.removeValue(forKey: queryId)
        self.queryIdsByKey.removeValue(forKey: key)
        guard self.socket != nil else { return }
        let version = self.currentVersion.querySet
        await self.safelySend(.modifyQuerySet(
            baseVersion: version,
            newVersion: version + 1,
            modifications: [.remove(queryId: queryId)]
        ))
        self.currentVersion = StateVersion(
            querySet: version + 1,
            ts: self.currentVersion.ts,
            identity: self.currentVersion.identity
        )
    }

    // MARK: Mutations

    public func mutate(path: String, argsObject: [String: ConvexJSON]) async throws -> MutationOutcome {
        guard self.socket != nil, !self.stopped else {
            return MutationOutcome(success: false, result: nil, errorMessage: "Not connected")
        }
        let requestId = self.nextRequestId
        self.nextRequestId += 1
        let message = SyncOutboundMessage.mutation(
            requestId: requestId,
            udfPath: path,
            args: ConvexJSON.args(argsObject)
        )
        self.scheduleMutationTimeout(requestId: requestId, seconds: 20)

        // The continuation body runs synchronously before suspension, so the
        // pending entry exists before any inbound frame can be processed. The
        // send itself is queued on this actor and executes before any response
        // could arrive.
        let outcome: MutationOutcome = await withCheckedContinuation { continuation in
            self.pendingMutations[requestId] = PendingMutation(continuation: continuation)
            self.unacknowledgedMutations[requestId] = message
            Task { await self.safelySend(message) }
        }

        // Read-your-writes: hold until a transition covers the commit timestamp.
        if outcome.success, let commitTs = committedTsByRequest.removeValue(forKey: requestId) {
            let deadline = Date().addingTimeInterval(5)
            while (self.maxObservedTimestamp ?? 0) < commitTs, Date() < deadline {
                try? await Task.sleep(for: .milliseconds(10))
            }
        }
        return outcome
    }

    private func scheduleMutationTimeout(requestId: Int, seconds: TimeInterval) {
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            await self?.timeOutMutation(requestId: requestId)
        }
    }

    private func timeOutMutation(requestId: Int) {
        guard let pending = pendingMutations.removeValue(forKey: requestId) else { return }
        self.unacknowledgedMutations.removeValue(forKey: requestId)
        self.committedTsByRequest.removeValue(forKey: requestId)
        pending.continuation.resume(
            returning: MutationOutcome(success: false, result: nil, errorMessage: "Timed out")
        )
    }

    // MARK: Socket handling

    private func syncURL() throws -> URL {
        guard var components = URLComponents(url: backendURL, resolvingAgainstBaseURL: false) else {
            throw ConvexSyncError.invalidBackendURL(self.backendURL)
        }
        switch components.scheme {
        case "http": components.scheme = "ws"
        case "https": components.scheme = "wss"
        default: throw ConvexSyncError.invalidBackendURL(self.backendURL)
        }
        components.path = "/api/\(Self.protocolVersion)/sync"
        guard let url = components.url else { throw ConvexSyncError.invalidBackendURL(self.backendURL) }
        return url
    }

    private func openSocket() async {
        guard !self.stopped else { return }
        do {
            let url = try syncURL()
            let task = self.urlSession.webSocketTask(with: url)
            self.socket = task
            self.lastInboundAt = Date()
            self.chunkBuffer = TransitionChunkBuffer()
            task.resume()
            self.receiveTask?.cancel()
            self.receiveTask = Task { [weak self] in
                await self?.receiveLoop()
            }
            await self.handleOpen()
        } catch {
            self.emit(.disconnected(reason: error.localizedDescription))
            self.scheduleReconnect()
        }
    }

    private func handleOpen() async {
        self.connectionCount += 1
        self.authBaseCounter = 0
        await self.safelySend(.connect(
            sessionId: self.sessionID,
            connectionCount: self.connectionCount - 1,
            lastCloseReason: self.lastCloseReason,
            maxObservedTimestamp: self.maxObservedTimestamp.map(ConvexTS.encodeUnsigned),
            clientTs: Self.monotonicMillis()
        ))
        // Per connection the server restarts identity versioning at 0.
        self.currentVersion = StateVersion(querySet: 0, ts: 0, identity: 0)
        if let token = authToken {
            await self.safelySend(.authenticateUser(token: token, baseVersion: 0))
            self.authBaseCounter = 1
        }
        // Replay every active query as one batch with journals preserved.
        let adds = self.queries
            .sorted(by: { $0.key < $1.key })
            .map { id, record in
                QuerySetModification.add(
                    queryId: id,
                    udfPath: record.path,
                    args: record.argsArray,
                    journal: record.journal
                )
            }
        if !adds.isEmpty {
            await self.safelySend(.modifyQuerySet(baseVersion: 0, newVersion: 1, modifications: adds))
            self.currentVersion = StateVersion(querySet: 1, ts: 0, identity: self.currentVersion.identity)
        }
        for (_, message) in self.unacknowledgedMutations.sorted(by: { $0.key < $1.key }) {
            await self.safelySend(message)
        }
        self.emit(.connected)
        await self.startWatchdogIfNeeded()
    }

    private func receiveLoop() async {
        while !self.stopped {
            guard let task = socket else { return }
            do {
                let message = try await task.receive()
                switch message {
                case .string(let text):
                    await self.handleFrameText(text)
                case .data:
                    continue
                @unknown default:
                    continue
                }
            } catch {
                guard !self.stopped else { return }
                self.socket = nil
                self.emit(.disconnected(reason: error.localizedDescription))
                self.scheduleReconnect()
                return
            }
        }
    }

    private func handleFrameText(_ text: String) async {
        self.lastInboundAt = Date()
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data),
              let typeName = (json as? [String: Any])?["type"] as? String
        else {
            return
        }
        if typeName == "TransitionChunk" {
            guard let joined = chunkBuffer.absorb(text) else { return }
            guard let joinedData = joined.data(using: .utf8),
                  let message = try? JSONDecoder().decode(SyncInboundMessage.self, from: joinedData)
            else {
                return
            }
            await self.handleMessage(message)
            return
        }
        guard let message = try? JSONDecoder().decode(SyncInboundMessage.self, from: data) else {
            return
        }
        await self.handleMessage(message)
    }

    private func handleMessage(_ message: SyncInboundMessage) async {
        switch message {
        case .transition(let transition):
            self.apply(transition)
        case .mutationResponse(let response):
            self.resolvePending(
                requestId: response.requestId,
                outcome: MutationOutcome(
                    success: response.success,
                    result: response.result,
                    errorMessage: response.errorMessage
                ),
                commitTs: response.ts
            )
        case .actionResponse(let response):
            self.resolvePending(
                requestId: response.requestId,
                outcome: MutationOutcome(
                    success: response.success,
                    result: response.result,
                    errorMessage: response.errorMessage
                ),
                commitTs: nil
            )
        case .authError(let authError):
            await self.handleAuthError(authError)
        case .fatalError(let errorMessage):
            self.stopped = true
            self.socket?.cancel(with: .normalClosure, reason: nil)
            self.socket = nil
            self.failAllPendingMutations(errorMessage)
            self.finishAllStreams()
            self.emit(.fatal(errorMessage))
        case .ping, .unknown:
            break
        }
    }

    private func apply(_ transition: Transition) {
        guard transition.startVersion == self.currentVersion else {
            Task { await self.forceReconnect(reason: "TransitionStartVersionMismatch") }
            return
        }
        for modification in transition.modifications {
            switch modification {
            case .updated(let updated):
                guard var record = queries[updated.queryId] else { continue }
                record.latest = updated.value ?? .null
                record.failure = nil
                record.journal = updated.journal
                let update = QueryUpdate(value: updated.value, failure: nil)
                for continuation in record.subscribers.values {
                    continuation.yield(update)
                }
                self.queries[updated.queryId] = record
            case .failed(let failed):
                guard var record = queries[failed.queryId] else { continue }
                record.failure = failed.errorMessage
                record.journal = failed.journal
                let update = QueryUpdate(value: nil, failure: failed.errorMessage)
                for continuation in record.subscribers.values {
                    continuation.yield(update)
                }
                self.queries[failed.queryId] = record
            case .removed(let queryId):
                self.queries.removeValue(forKey: queryId)
            }
        }
        self.currentVersion = transition.endVersion
        if (self.maxObservedTimestamp ?? 0) < transition.endVersion.ts {
            self.maxObservedTimestamp = transition.endVersion.ts
        }
        // Identity advancement confirms token acceptance.
        if transition.endVersion.identity > transition.startVersion.identity {
            self.authRefreshAttempts = 0
        }
        self.retryCount = 0
    }

    private func handleAuthError(_ authError: AuthError) async {
        // AuthErrors from function execution with stale auth are ignored;
        // only failures of a fresh Authenticate trigger refresh.
        guard authError.authUpdateAttempted else { return }
        guard self.authRefreshAttempts < 2 else {
            self.authToken = nil
            self.failAllPendingMutations("Authentication failed: \(authError.error)")
            self.emit(.authFailed(authError.error))
            await self.forceReconnect(reason: "AuthFailed")
            return
        }
        self.authRefreshAttempts += 1
        let fresh = await tokenProvider?(true)
        if let fresh {
            self.authToken = fresh
            await self.forceReconnect(reason: "AuthRefresh")
        } else {
            self.authToken = nil
            self.emit(.authFailed(authError.error))
            await self.forceReconnect(reason: "AuthRefreshUnavailable")
        }
    }

    private func resolvePending(requestId: Int, outcome: MutationOutcome, commitTs: UInt64?) {
        guard let pending = pendingMutations.removeValue(forKey: requestId) else { return }
        self.unacknowledgedMutations.removeValue(forKey: requestId)
        if let commitTs {
            self.committedTsByRequest[requestId] = commitTs
            if (self.maxObservedTimestamp ?? 0) < commitTs {
                self.maxObservedTimestamp = commitTs
            }
        }
        pending.continuation.resume(returning: outcome)
    }

    // MARK: Reconnect / watchdog

    private func forceReconnect(reason: String) async {
        guard !self.stopped else { return }
        self.lastCloseReason = reason
        self.receiveTask?.cancel()
        self.socket?.cancel(with: .goingAway, reason: nil)
        self.socket = nil
        await self.openSocket()
    }

    private func scheduleReconnect() {
        guard !self.stopped else { return }
        self.retryCount += 1
        let exponential = min(pow(2, Double(retryCount)), Self.maxBackoffSeconds)
        let jittered = exponential * Double.random(in: 0.5 ... 1.5)
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(jittered))
            await self?.openSocket()
        }
    }

    private func startWatchdogIfNeeded() async {
        guard !self.watchdogRunning else { return }
        self.watchdogRunning = true
        Task { [weak self] in
            while true {
                try? await Task.sleep(for: .seconds(15))
                guard let strongSelf = self else { return }
                if await strongSelf.watchdogTickShouldExit() {
                    await strongSelf.clearWatchdog()
                    return
                }
            }
        }
    }

    private func clearWatchdog() {
        self.watchdogRunning = false
    }

    /// Returns true only when the client is permanently stopped; transient
    /// disconnects keep the watchdog alive.
    private func watchdogTickShouldExit() -> Bool {
        if self.stopped {
            return true
        }
        guard self.socket != nil else { return false }
        if Date().timeIntervalSince(self.lastInboundAt) > Self.serverInactivitySeconds {
            Task { await self.forceReconnect(reason: "InactiveServer") }
        }
        return false
    }

    // MARK: Helpers

    private func safelySend(_ message: SyncOutboundMessage) async {
        guard let task = socket,
              let data = try? message.encodedDataViaEncoder(),
              let text = String(data: data, encoding: .utf8) else { return }
        try? await task.send(.string(text))
    }

    private func failAllPendingMutations(_ errorMessage: String) {
        for (_, pending) in self.pendingMutations {
            pending.continuation.resume(
                returning: MutationOutcome(success: false, result: nil, errorMessage: errorMessage)
            )
        }
        self.pendingMutations.removeAll()
        self.committedTsByRequest.removeAll()
    }

    private func finishAllStreams() {
        for (_, record) in self.queries {
            for continuation in record.subscribers.values {
                continuation.finish()
            }
        }
    }

    private func emit(_ status: Status) {
        self.statusHandler(status)
    }

    private static func monotonicMillis() -> Int64 {
        Int64(DispatchTime.now().uptimeNanoseconds / 1_000_000)
    }
}

extension SyncOutboundMessage {
    func encodedDataViaEncoder() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self)
    }
}

public enum ConvexSyncError: Error {
    case invalidBackendURL(URL)
}
