import Foundation

// Wire messages for the Convex sync protocol (`convex@1.43.0`).
// One JSON object per text frame; field names are exact.

// MARK: - Outbound

public enum SyncOutboundMessage: Sendable, Encodable {
    case connect(
        sessionId: String,
        connectionCount: Int,
        lastCloseReason: String?,
        maxObservedTimestamp: String?,
        clientTs: Int64
    )
    case modifyQuerySet(
        baseVersion: Int,
        newVersion: Int,
        modifications: [QuerySetModification]
    )
    case mutation(requestId: Int, udfPath: String, args: ConvexJSON)
    case action(requestId: Int, udfPath: String, args: ConvexJSON)
    case authenticateUser(token: String, baseVersion: Int)
    case authenticateNone(baseVersion: Int)

    private enum CodingKeys: String, CodingKey {
        case type, sessionId, connectionCount, lastCloseReason
        case maxObservedTimestamp, clientTs
        case baseVersion, newVersion, modifications
        case requestId, udfPath, args
        case tokenType, value
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .connect(let sessionId, let connectionCount, let lastCloseReason, let maxObserved, let clientTs):
            try container.encode("Connect", forKey: .type)
            try container.encode(sessionId, forKey: .sessionId)
            try container.encode(connectionCount, forKey: .connectionCount)
            if let lastCloseReason {
                try container.encode(lastCloseReason, forKey: .lastCloseReason)
            } else {
                try container.encodeNil(forKey: .lastCloseReason)
            }
            if let maxObserved {
                try container.encode(maxObserved, forKey: .maxObservedTimestamp)
            }
            try container.encode(clientTs, forKey: .clientTs)
        case .modifyQuerySet(let baseVersion, let newVersion, let modifications):
            try container.encode("ModifyQuerySet", forKey: .type)
            try container.encode(baseVersion, forKey: .baseVersion)
            try container.encode(newVersion, forKey: .newVersion)
            try container.encode(modifications, forKey: .modifications)
        case .mutation(let requestId, let udfPath, let args):
            try container.encode("Mutation", forKey: .type)
            try container.encode(requestId, forKey: .requestId)
            try container.encode(udfPath, forKey: .udfPath)
            try container.encode(args, forKey: .args)
        case .action(let requestId, let udfPath, let args):
            try container.encode("Action", forKey: .type)
            try container.encode(requestId, forKey: .requestId)
            try container.encode(udfPath, forKey: .udfPath)
            try container.encode(args, forKey: .args)
        case .authenticateUser(let token, let baseVersion):
            try container.encode("Authenticate", forKey: .type)
            try container.encode("User", forKey: .tokenType)
            try container.encode(token, forKey: .value)
            try container.encode(baseVersion, forKey: .baseVersion)
        case .authenticateNone(let baseVersion):
            try container.encode("Authenticate", forKey: .type)
            try container.encode("None", forKey: .tokenType)
            try container.encode(baseVersion, forKey: .baseVersion)
        }
    }
}

public struct QuerySetModification: Sendable, Encodable {
    public enum Kind: String, Sendable, Encodable {
        case add = "Add"
        case remove = "Remove"
    }

    public let type: Kind
    public let queryId: Int
    public let udfPath: String?
    /// Single-element array wrapping the args object.
    public let args: ConvexJSON?
    public let journal: String?

    public static func add(
        queryId: Int,
        udfPath: String,
        args: ConvexJSON,
        journal: String?
    ) -> QuerySetModification {
        QuerySetModification(type: .add, queryId: queryId, udfPath: udfPath, args: args, journal: journal)
    }

    public static func remove(queryId: Int) -> QuerySetModification {
        QuerySetModification(type: .remove, queryId: queryId, udfPath: nil, args: nil, journal: nil)
    }

    private enum CodingKeys: String, CodingKey {
        case type, queryId, udfPath, args, journal
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(self.type, forKey: .type)
        try container.encode(self.queryId, forKey: .queryId)
        switch self.type {
        case .add:
            try container.encode(self.udfPath, forKey: .udfPath)
            try container.encode(self.args, forKey: .args)
            // The journal key is always present on Add: null until the server
            // has echoed one back.
            if let journal = self.journal {
                try container.encode(journal, forKey: .journal)
            } else {
                try container.encodeNil(forKey: .journal)
            }
        case .remove:
            break
        }
    }
}

// MARK: - Inbound

public enum SyncInboundMessage: Sendable {
    case transition(Transition)
    case mutationResponse(MutationResponse)
    case actionResponse(ActionResponse)
    case authError(AuthError)
    case fatalError(String)
    case ping
    case unknown(type: String)
}

public struct StateVersion: Sendable, Equatable {
    public let querySet: Int
    /// Decoded from base64 LE u64 wire string.
    public let ts: UInt64
    public let identity: Int

    public init(querySet: Int, ts: UInt64, identity: Int) {
        self.querySet = querySet
        self.ts = ts
        self.identity = identity
    }
}

public enum StateModification: Sendable {
    case updated(QueryUpdated)
    case failed(QueryFailed)
    case removed(queryId: Int)
}

public struct QueryUpdated: Sendable {
    public let queryId: Int
    public let value: ConvexJSON?
    public let logLines: [String]
    /// Verbatim from the wire: nil when the server sent null.
    public let journal: String?
}

public struct QueryFailed: Sendable {
    public let queryId: Int
    public let errorMessage: String
    public let logLines: [String]
    public let errorData: ConvexJSON?
    /// Verbatim from the wire: nil when the server sent null.
    public let journal: String?
}

public struct Transition: Sendable {
    public let startVersion: StateVersion
    public let endVersion: StateVersion
    public let modifications: [StateModification]
}

public struct MutationResponse: Sendable {
    public let requestId: Int
    public let success: Bool
    /// Success payload value, or failure message string.
    public let result: ConvexJSON?
    public let errorMessage: String?
    public let errorData: ConvexJSON?
    /// Commit timestamp (decoded u64); present on success.
    public let ts: UInt64?
}

public struct ActionResponse: Sendable {
    public let requestId: Int
    public let success: Bool
    public let result: ConvexJSON?
    public let errorMessage: String?
    public let errorData: ConvexJSON?
}

public struct AuthError: Sendable {
    public let error: String
    public let baseVersion: Int
    public let authUpdateAttempted: Bool
}

extension SyncInboundMessage: Decodable {
    private enum CodingKeys: String, CodingKey {
        case type
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "Transition":
            self = try .transition(Transition(from: decoder))
        case "MutationResponse":
            self = try .mutationResponse(MutationResponse(from: decoder))
        case "ActionResponse":
            self = try .actionResponse(ActionResponse(from: decoder))
        case "AuthError":
            self = try .authError(AuthError(from: decoder))
        case "FatalError":
            let extra = try decoder.container(keyedBy: FatalKeys.self)
            self = try .fatalError(extra.decode(String.self, forKey: .error))
        case "Ping":
            self = .ping
        default:
            self = .unknown(type: type)
        }
    }

    private enum FatalKeys: String, CodingKey {
        case error
    }
}

extension Transition: Decodable {
    private enum Keys: String, CodingKey {
        case startVersion, endVersion, modifications
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        self.startVersion = try container.decode(StateVersion.self, forKey: .startVersion)
        self.endVersion = try container.decode(StateVersion.self, forKey: .endVersion)
        let rawMods = try container.decode([ConvexJSON].self, forKey: .modifications)
        self.modifications = rawMods.map(StateModification.init(wire:))
    }
}

extension StateVersion: Decodable {
    private enum Keys: String, CodingKey {
        case querySet, ts, identity
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        self.querySet = try container.decode(Int.self, forKey: .querySet)
        let encodedTs = try container.decode(String.self, forKey: .ts)
        guard let decoded = ConvexTS.decodeUnsigned(encodedTs) else {
            throw DecodingError.dataCorruptedError(
                forKey: .ts, in: container,
                debugDescription: "invalid base64 LE timestamp \(encodedTs)"
            )
        }
        self.ts = decoded
        self.identity = try container.decode(Int.self, forKey: .identity)
    }
}

extension StateModification {
    private enum Keys: String, CodingKey {
        case type, queryId, value, logLines, journal, errorMessage, errorData
    }

    fileprivate init(wire: ConvexJSON) {
        guard wire.objectValue != nil else {
            self = .removed(queryId: -1)
            return
        }
        let queryId = Int(wire.int64("queryId"))
        guard let type = wire["type"]?.stringValue else {
            self = .removed(queryId: queryId)
            return
        }
        let logLines = wire.array("logLines").compactMap(\.stringValue)
        // Journal is string | null on the wire; pass through verbatim so
        // reconnect Adds re-send exactly what the server last sent.
        let journal: String? = switch wire["journal"] {
        case .some(.string(let s)): s
        default: nil
        }
        switch type {
        case "QueryUpdated":
            self = .updated(QueryUpdated(
                queryId: queryId,
                value: wire["value"],
                logLines: logLines,
                journal: journal
            ))
        case "QueryFailed":
            self = .failed(QueryFailed(
                queryId: queryId,
                errorMessage: wire.optionalString("errorMessage") ?? "unknown",
                logLines: logLines,
                errorData: wire["errorData"],
                journal: journal
            ))
        default:
            self = .removed(queryId: queryId)
        }
    }
}

extension MutationResponse: Decodable {
    private enum Keys: String, CodingKey {
        case requestId, success, result, ts, errorData
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        self.requestId = try container.decode(Int.self, forKey: .requestId)
        self.success = try container.decode(Bool.self, forKey: .success)
        self.result = try? container.decode(ConvexJSON.self, forKey: .result)
        if self.success {
            self.errorMessage = nil
            self.errorData = nil
            let encoded = try container.decode(String.self, forKey: .ts)
            guard let decoded = ConvexTS.decodeUnsigned(encoded) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .ts, in: container,
                    debugDescription: "invalid commit ts \(encoded)"
                )
            }
            self.ts = decoded
        } else {
            self.errorMessage = (try? container.decode(String.self, forKey: .result)) ?? "mutation failed"
            self.errorData = try? container.decode(ConvexJSON.self, forKey: .errorData)
            self.ts = nil
        }
    }
}

extension ActionResponse: Decodable {
    private enum Keys: String, CodingKey {
        case requestId, success, result, errorData
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        self.requestId = try container.decode(Int.self, forKey: .requestId)
        self.success = try container.decode(Bool.self, forKey: .success)
        self.result = try? container.decode(ConvexJSON.self, forKey: .result)
        if self.success {
            self.errorMessage = nil
            self.errorData = nil
        } else {
            self.errorMessage = (try? container.decode(String.self, forKey: .result)) ?? "action failed"
            self.errorData = try? container.decode(ConvexJSON.self, forKey: .errorData)
        }
    }
}

extension AuthError: Decodable {
    private enum Keys: String, CodingKey {
        case error, baseVersion, authUpdateAttempted
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        self.error = try container.decode(String.self, forKey: .error)
        self.baseVersion = try container.decode(Int.self, forKey: .baseVersion)
        self.authUpdateAttempted = try container.decode(Bool.self, forKey: .authUpdateAttempted)
    }
}

/// Reassembly buffer for split transitions.
public struct TransitionChunkBuffer {
    private var parts: [Int: String] = [:]
    private var totalParts = 0
    private var transitionId = ""

    public init() {}

    /// Returns joined JSON text when complete; resets state on any gap/order change.
    public mutating func absorb(_ text: String) -> String? {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data),
              let obj = json as? [String: Any],
              obj["type"] as? String == "TransitionChunk" else { return nil }
        let id = obj["transitionId"] as? String ?? ""
        let partNumber = obj["partNumber"] as? Int ?? -1
        let total = obj["totalParts"] as? Int ?? 0
        let chunk = obj["chunk"] as? String ?? ""

        // A part 0 always (re)starts an assembly — including after a prior
        // stream was aborted mid-way.
        if partNumber == 0 {
            self.transitionId = id
            self.totalParts = total
            self.parts = [:]
        }
        guard id == self.transitionId, partNumber == self.parts.count, total == self.totalParts, total > 0 else {
            self.parts = [:]
            return nil
        }
        self.parts[partNumber] = chunk
        guard self.parts.count == self.totalParts else { return nil }
        let joined = (0 ..< self.totalParts).compactMap { self.parts[$0] }.joined()
        self.parts = [:]
        return joined
    }
}
