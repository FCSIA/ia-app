import Foundation

// Domain models decoded from Convex wire values. Field names mirror the
// backend validators exactly (see apps/convex/src/clubs/channels.ts).

// MARK: People

public struct ClubUser: Sendable, Hashable, Identifiable {
    public let id: String
    public let uniqueId: String
    public let firstName: String
    public let lastName: String
    public let avatarUrl: String?

    public var displayName: String {
        let joined = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        return joined.isEmpty ? "Member" : joined
    }

    public init(json: ConvexJSON) throws {
        self.id = try json.string("_id")
        self.uniqueId = try json.string("uniqueId")
        self.firstName = (json.optionalString("firstName") ?? "")
        self.lastName = (json.optionalString("lastName") ?? "")
        self.avatarUrl = json.optionalString("avatarUrl")
    }

    public init(id: String, uniqueId: String, firstName: String, lastName: String, avatarUrl: String?) {
        self.id = id
        self.uniqueId = uniqueId
        self.firstName = firstName
        self.lastName = lastName
        self.avatarUrl = avatarUrl
    }
}

// MARK: Messages

public struct ReactionSummary: Sendable, Hashable, Identifiable {
    public let emoji: String
    public let count: Int
    public let reactedByCurrentUser: Bool
    public let countIsCapped: Bool

    public var id: String {
        self.emoji
    }

    public init(json: ConvexJSON) throws {
        self.emoji = try json.string("emoji")
        self.count = Int(json.int64("count"))
        self.reactedByCurrentUser = json.bool("reactedByCurrentUser")
        self.countIsCapped = json.bool("countIsCapped")
    }
}

public struct MessageAttachment: Sendable, Hashable, Identifiable {
    public let id: String
    public let fileName: String
    public let fileUrl: String
    public let mimeType: String?
    public let size: Int64?

    public var isImage: Bool {
        guard let mimeType else { return false }
        return mimeType.hasPrefix("image/")
    }

    public init(json: ConvexJSON) throws {
        self.id = try json.string("_id")
        self.fileName = try json.string("fileName")
        self.fileUrl = try json.string("fileUrl")
        self.mimeType = json.optionalString("mimeType")
        self.size = json["size"]?.int64Value
    }
}

public struct PollOptionSummary: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let count: Int
    public let votedByCurrentUser: Bool

    public init(json: ConvexJSON) throws {
        self.id = try json.string("id")
        self.label = try json.string("label")
        self.count = Int(json.int64("count"))
        self.votedByCurrentUser = json.bool("votedByCurrentUser")
    }
}

public struct PollSummary: Sendable, Hashable {
    public let question: String
    public let options: [PollOptionSummary]
    public let totalVotes: Int

    public init(json: ConvexJSON) throws {
        self.question = try json.string("question")
        self.options = try json.array("options").map(PollOptionSummary.init)
        self.totalVotes = Int(json.int64("totalVotes"))
    }
}

public struct LatestReplyPreview: Sendable, Hashable {
    public let id: String
    public let body: String
    public let isDeleted: Bool

    public init(json: ConvexJSON) throws {
        self.id = try json.string("_id")
        self.body = try json.string("body")
        self.isDeleted = json.bool("isDeleted")
    }
}

public struct MessageSummary: Sendable, Hashable, Identifiable {
    public let id: String
    public let creationTimeMs: Int64
    public let channelId: String
    public let parentMessageId: String?
    public let replyToMessageId: String?
    public let threadRootId: String
    public let body: String
    public let bodyMarkdown: String?
    public let isPinned: Bool
    public let isDeleted: Bool
    public let createdAtISO: String
    public let updatedAtISO: String
    public let author: ClubUser
    public let attachments: [MessageAttachment]
    public let attachmentsTruncated: Bool
    public let reactions: [ReactionSummary]
    public let reactionsTruncated: Bool
    public let replyCount: Int
    public let replyCountIsExact: Bool
    public let hasReplies: Bool
    public let latestReplyPreview: LatestReplyPreview?
    public let poll: PollSummary?

    public init(json: ConvexJSON) throws {
        self.id = try json.string("_id")
        self.creationTimeMs = json["_creationTime"]?.int64Value ?? 0
        self.channelId = try json.string("channelId")
        self.parentMessageId = json.optionalString("parentMessageId")
        self.replyToMessageId = json.optionalString("replyToMessageId")
        self.threadRootId = try json.string("threadRootId")
        self.body = try json.string("body")
        self.bodyMarkdown = json.optionalString("bodyMarkdown")
        self.isPinned = json.bool("isPinned")
        self.isDeleted = json.bool("isDeleted")
        self.createdAtISO = try json.string("createdAt")
        self.updatedAtISO = try json.string("updatedAt")
        self.author = try ClubUser(json: json.require("author"))
        self.attachments = try json.array("attachments").map(MessageAttachment.init)
        self.attachmentsTruncated = json.bool("attachmentsTruncated")
        self.reactions = try json.array("reactions").map(ReactionSummary.init)
        self.reactionsTruncated = json.bool("reactionsTruncated")
        self.replyCount = Int(json.int64("replyCount"))
        self.replyCountIsExact = json.bool("replyCountIsExact")
        self.hasReplies = json.bool("hasReplies")
        self.latestReplyPreview = try? LatestReplyPreview(json: json.require("latestReplyPreview"))
        switch json["poll"] {
        case .some(let raw) where !raw.isNull && raw.objectValue != nil:
            self.poll = try? PollSummary(json: raw)
        default:
            self.poll = nil
        }
    }

    public var createdAt: Date? {
        ISO8601DateParser.parse(self.createdAtISO)
    }
}

public enum ISO8601DateParser {
    /// Thread-safe parse entry points; shared instances avoid allocation churn.
    private nonisolated(unsafe) static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private nonisolated(unsafe) static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    public static func parse(_ value: String) -> Date? {
        self.fractional.date(from: value) ?? self.plain.date(from: value)
    }
}

/// Reactive pagination wrapper for message pages.
public typealias MessagePage = ConvexPage<MessageSummary>

// MARK: Conversation context

public struct ConversationContext: Sendable, Hashable {
    public let clubName: String
    public let channelName: String
    public let channelDescription: String?
    public let visibility: String
    public let viewerCanPost: Bool
    public let canCreatePolls: Bool
    public let canPinMessages: Bool
    public let canModerateMessages: Bool

    public init(json: ConvexJSON) throws {
        self.clubName = try json.string("clubName")
        let channel = try json.require("channel")
        self.channelName = try channel.string("name")
        self.channelDescription = channel.optionalString("description")
        self.visibility = try channel.string("visibility")
        self.viewerCanPost = channel.bool("viewerCanPost")
        self.canCreatePolls = json.bool("canCreatePolls")
        self.canPinMessages = json.bool("canPinMessages")
        self.canModerateMessages = json.bool("canModerateMessages")
    }
}

// MARK: Clubs / workspace navigation

public struct ClubSummaryModel: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let logoUrl: String?
    public let memberCount: Int
    public let channelCount: Int
    public let viewerRole: String?

    public init(json: ConvexJSON) throws {
        self.id = try json.string("_id")
        self.name = try json.string("name")
        self.description = json.optionalString("description")
        self.logoUrl = json.optionalString("logoUrl")
        self.memberCount = Int((json["count"] ?? json["_count"])?["members"]?.int64Value ?? 0)
        self.channelCount = Int((json["count"] ?? json["_count"])?["channels"]?.int64Value ?? 0)
        self.viewerRole = json.optionalString("role")
    }
}

public struct WorkspaceChannel: Sendable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let description: String?
    public let visibility: String

    public init(json: ConvexJSON) throws {
        self.id = try json.string("_id")
        self.name = try json.string("name")
        self.description = json.optionalString("description")
        self.visibility = try json.string("visibility")
    }
}

public struct WorkspaceNavigation: Sendable, Hashable {
    public let clubId: String
    public let clubName: String
    public let clubLogoUrl: String?
    public let channels: [WorkspaceChannel]

    public init(json: ConvexJSON) throws {
        let club = try json.require("club")
        self.clubId = try club.string("_id")
        self.clubName = try club.string("name")
        self.clubLogoUrl = club.optionalString("logoUrl")
        self.channels = try json.array("channels").map(WorkspaceChannel.init)
    }
}
