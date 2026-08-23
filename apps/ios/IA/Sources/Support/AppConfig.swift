import Foundation

/// Deployment endpoints supplied via environment variables so no shared
/// Convex deployment is ever selected implicitly.
///
/// Defaults target a loopback local deployment (`pnpm setup:convex-local`
/// shape). Override with `IA_CONVEX_URL` / `IA_CONVEX_SITE_URL`.
public struct BackendConfig: Sendable {
    public let convexURL: URL
    public let siteURL: URL

    public init(convexURL: URL, siteURL: URL) {
        self.convexURL = convexURL
        self.siteURL = siteURL
    }

    public static func fromEnvironment(_ environment: [String: String] = ProcessInfo.processInfo.environment) -> BackendConfig {
        BackendConfig(
            convexURL: URL(
                string: environment["IA_CONVEX_URL"] ?? "http://127.0.0.1:3210"
            ) ?? URL(string: "http://127.0.0.1:3210")!,
            siteURL: URL(
                string: environment["IA_CONVEX_SITE_URL"] ?? "http://127.0.0.1:3211"
            ) ?? URL(string: "http://127.0.0.1:3211")!
        )
    }
}

/// Canonical reaction tokens accepted by the backend (`validators.ts`).
public enum QuickReaction: String, CaseIterable, Sendable, Identifiable {
    case like = "LIKE"
    case heart = "HEART"
    case fire = "FIRE"
    case celebrate = "CELEBRATE"
    case eyes = "EYES"
    case done = "DONE"

    public var id: String {
        rawValue
    }

    public var glyph: String {
        switch self {
        case .like: "👍"
        case .heart: "❤️"
        case .fire: "🔥"
        case .celebrate: "🎉"
        case .eyes: "👀"
        case .done: "✅"
        }
    }

    public init?(emojiToken: String) {
        guard let match = QuickReaction.allCases.first(where: { $0.rawValue == emojiToken }) else {
            return nil
        }
        self = match
    }
}

public enum ChatLimits {
    /// Matches MESSAGE_PAGE_SIZE in apps/mobile.
    public static let pageSize: Int32 = 30
    public static let bodyMaxLength = 4000
}
