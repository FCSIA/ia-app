import Foundation
import Observation

/// Owns the reactive chat state for one channel: conversation context,
/// chained live pages (reactive pagination), optimistic sends, reactions,
/// and poll votes.
@MainActor
@Observable
public final class ChatViewModel: Identifiable {
    public struct OptimisticEntry: Identifiable, Equatable {
        public let id: String
        public let body: String
        public let createdAt: Date
        public var failed: Bool = false
    }

    private struct PageRecord {
        let paginationId: Int
        var items: [MessageSummary]
        var isDone: Bool
        var continueCursor: String?
    }

    public let clubId: String
    public let channelId: String
    public let channelNameFallback: String

    public private(set) var context: ConversationContext?
    /// Ascending display order (oldest first).
    public private(set) var messages: [MessageSummary] = []
    public private(set) var optimisticEntries: [OptimisticEntry] = []
    public private(set) var canLoadOlder = false
    public private(set) var isLoadingOlder = false
    public private(set) var actionFailure: String?
    public private(set) var initialLoading = true

    private var pages: [PageRecord] = []
    private var liveTasks: [Task<Void, Never>] = []
    private var nextPaginationId = 1
    /// mutation-returned message id -> optimistic entry id awaiting reconciliation.
    private var reconciling: [String: String] = [:]

    public init(clubId: String, channelId: String, channelNameFallback: String) {
        self.clubId = clubId
        self.channelId = channelId
        self.channelNameFallback = channelNameFallback
    }

    public var channelTitle: String {
        self.context?.channelName ?? self.channelNameFallback
    }

    // MARK: Lifecycle

    public func start(client: ConvexSyncClient) {
        self.liveTasks.append(Task { [weak self] in
            await self?.runContext(client: client)
        })
        self.liveTasks.append(Task { [weak self] in
            await self?.runBasePage(client: client)
        })
    }

    public func stop() {
        for task in self.liveTasks {
            task.cancel()
        }
        self.liveTasks.removeAll()
    }

    private func runContext(client: ConvexSyncClient) async {
        let stream = client.subscribe(
            path: "clubs/channels:getConversationContext",
            argsObject: [
                "clubId": .string(self.clubId),
                "channelId": .string(self.channelId)
            ]
        )
        for await update in stream {
            if update.failure == nil, let value = update.value, !value.isNull {
                self.context = try? ConversationContext(json: value)
            }
        }
    }

    private func runBasePage(client: ConvexSyncClient) async {
        let stream = client.subscribe(
            path: "clubs/channels:getMessagePage",
            argsObject: [
                "clubId": .string(self.clubId),
                "channelId": .string(self.channelId),
                "paginationOpts": self.paginationOpts(cursor: nil, id: 1)
            ]
        )
        for await update in stream {
            guard update.failure == nil, let value = update.value, !value.isNull else {
                if let failure = update.failure {
                    self.actionFailure = failure
                }
                self.initialLoading = false
                continue
            }
            if let page = try? ConvexPage<MessageSummary>.decode(value, item: MessageSummary.init) {
                self.upsertPage(paginationId: 1, page: page)
                self.initialLoading = false
            }
        }
    }

    // MARK: Older pages

    public func loadOlderIfNeeded(client: ConvexSyncClient) {
        guard !self.isLoadingOlder, self.canLoadOlder,
              let oldest = pages.last,
              let cursor = oldest.continueCursor, !cursor.isEmpty else { return }
        self.isLoadingOlder = true
        let paginationId = self.nextPaginationId + 100
        self.nextPaginationId += 1
        let clubId = clubId
        let channelId = channelId
        self.liveTasks.append(Task { [weak self] in
            guard let strongSelf = self else { return }
            let stream = client.subscribe(
                path: "clubs/channels:getMessagePage",
                argsObject: [
                    "clubId": .string(clubId),
                    "channelId": .string(channelId),
                    "paginationOpts": strongSelf.paginationOpts(cursor: cursor, id: paginationId)
                ]
            )
            for await update in stream {
                guard update.failure == nil, let value = update.value, !value.isNull else { continue }
                if let page = try? ConvexPage<MessageSummary>.decode(value, item: MessageSummary.init) {
                    strongSelf.upsertPage(paginationId: paginationId, page: page)
                    break // one authoritative delivery is enough for an older window
                }
            }
            strongSelf.isLoadingOlder = false
        })
    }

    private func paginationOpts(cursor: String?, id: Int) -> ConvexJSON {
        .object([
            "cursor": cursor.map { .string($0) } ?? .null,
            "numItems": .int64(Int64(ChatLimits.pageSize)),
            "id": .int64(Int64(id))
        ])
    }

    private func upsertPage(paginationId: Int, page: ConvexPage<MessageSummary>) {
        if let index = pages.firstIndex(where: { $0.paginationId == paginationId }) {
            self.pages[index].items = page.items
            self.pages[index].isDone = page.isDone
            self.pages[index].continueCursor = page.continueCursor
        } else {
            self.pages.append(PageRecord(
                paginationId: paginationId,
                items: page.items,
                isDone: page.isDone,
                continueCursor: page.continueCursor
            ))
        }
        self.recompute()
    }

    private func recompute() {
        var byId: [String: MessageSummary] = [:]
        for page in self.pages {
            for message in page.items {
                byId[message.id] = message
            }
        }
        self.messages = byId.values.sorted {
            ($0.creationTimeMs, $0.id) < ($1.creationTimeMs, $1.id)
        }
        if let oldest = pages.last {
            self.canLoadOlder = !oldest.isDone && !(oldest.continueCursor ?? "").isEmpty
        }
        self.reconcileOptimistic()
    }

    private func reconcileOptimistic() {
        guard !self.reconciling.isEmpty else { return }
        let knownIds = Set(messages.map(\.id))
        self.reconciling = self.reconciling.filter { messageId, _ in
            !knownIds.contains(messageId)
        }
        let pendingIds = Set(reconciling.values)
        self.optimisticEntries.removeAll { pendingIds.contains($0.id) }
    }

    // MARK: Actions

    public func send(_ rawText: String, client: ConvexSyncClient) async {
        let body = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, body.count <= ChatLimits.bodyMaxLength else { return }

        let generatedId = Self.makeClientGeneratedId()
        let entry = OptimisticEntry(id: "optimistic:\(generatedId)", body: body, createdAt: Date())
        self.optimisticEntries.append(entry)

        var args: [String: ConvexJSON] = [
            "channelId": .string(channelId),
            "body": .string(body),
            "clientGeneratedId": .string(generatedId),
            "clientSentAt": .double(Double(Date().timeIntervalSince1970 * 1000))
        ]
        if body != rawText || body.contains("\n") || Self.looksLikeMarkdown(body) {
            args["bodyMarkdown"] = .string(body)
        }

        let outcome = await (try? client.mutate(path: "clubs/channels:postMessage", argsObject: args))
            ?? ConvexSyncClient.MutationOutcome(success: false, result: nil, errorMessage: "Send failed")

        if outcome.success {
            if let newId = outcome.result?.stringValue {
                self.reconciling[newId] = entry.id
                self.reconcileOptimistic()
                // Safety net if reconciliation lags.
                let optimisticId = entry.id
                Task { [weak self] in
                    try? await Task.sleep(for: .seconds(8))
                    self?.dropOptimisticIfStillPresent(optimisticId)
                }
            }
        } else {
            if let index = optimisticEntries.firstIndex(where: { $0.id == entry.id }) {
                self.optimisticEntries[index].failed = true
            }
            self.actionFailure = outcome.errorMessage
        }
    }

    public func toggleReaction(_ token: QuickReaction, messageId: String, client: ConvexSyncClient) async {
        let outcome = await (try? client.mutate(
            path: "clubs/channels:toggleReaction",
            argsObject: ["messageId": .string(messageId), "emoji": .string(token.rawValue)]
        )) ?? ConvexSyncClient.MutationOutcome(success: false, result: nil, errorMessage: "Reaction failed")
        if !outcome.success {
            self.actionFailure = outcome.errorMessage
        }
    }

    public func votePoll(optionId: String, messageId: String, client: ConvexSyncClient) async {
        _ = try? await client.mutate(
            path: "clubs/channels:votePoll",
            argsObject: ["messageId": .string(messageId), "optionId": .string(optionId)]
        )
    }

    private func dropOptimisticIfStillPresent(_ id: String) {
        self.optimisticEntries.removeAll { $0.id == id }
    }

    /// View layer hook for dismissing the failure alert.
    public func clearActionFailure() {
        self.actionFailure = nil
    }

    /// Matches createClientMessageIdentity(): "<time36>-<seq>-<rand>" style,
    /// kept short and URL-safe.
    private static var identitySequence: UInt64 = 0

    static func makeClientGeneratedId() -> String {
        self.identitySequence += 1
        let time = String(Int64(Date().timeIntervalSince1970 * 1000), radix: 36)
        let sequence = String(identitySequence, radix: 36)
        let random = String(Int64.random(in: 0 ..< 2_176_782_336), radix: 36)
        return "\(time)-\(sequence)-\(random)"
    }

    static func looksLikeMarkdown(_ text: String) -> Bool {
        text.contains("**") || text.contains("*") || text.contains("`") || text.contains("[") && text.contains("](")
    }
}
