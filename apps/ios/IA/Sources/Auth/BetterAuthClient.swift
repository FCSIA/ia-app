import Foundation
import Security

// MARK: - Session stores

public protocol SessionStore: Sendable {
    func data(forKey key: String) -> Data?
    func set(_ data: Data?, forKey key: String)
}

public final class InMemorySessionStore: SessionStore, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Data] = [:]

    public init() {}

    public func data(forKey key: String) -> Data? {
        self.lock.lock()
        defer { lock.unlock() }
        return self.storage[key]
    }

    public func set(_ data: Data?, forKey key: String) {
        self.lock.lock()
        defer { lock.unlock() }
        self.storage[key] = data
    }
}

/// Keychain-backed generic-password store.
public struct KeychainSessionStore: SessionStore {
    public let service: String

    public init(service: String = "org.fcsia.ia.experiment") {
        self.service = service
    }

    public func data(forKey key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: self.service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    public func set(_ data: Data?, forKey key: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: self.service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(base as CFDictionary)
        guard let data else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}

// MARK: - Errors

public enum BetterAuthError: LocalizedError {
    case invalidURL(String)
    case http(status: Int, message: String?)
    case missingField(String)

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url): "Invalid URL: \(url)"
        case .http(let status, let message):
            message ?? "Request failed (\(status))"
        case .missingField(let field): "Response missing field: \(field)"
        }
    }
}

// MARK: - Client

/// Better Auth HTTP client speaking directly to the Convex-hosted auth routes
/// (`/api/auth/*` on the site URL), mimicking exactly what the Expo client
/// sends: manual cookie header, `expo-origin`, and `x-skip-oauth-proxy`.
public actor BetterAuthClient {
    static let jarKey = "ia_ios_cookie_jar"
    static let sessionCacheKey = "ia_ios_session_cache"

    private let siteURL: URL
    private let origin: String
    private let store: SessionStore
    private let urlSession: URLSession
    private var jar = CookieJar()
    private var cachedSessionJSON: ConvexJSON?

    public init(siteURL: URL, origin: String = "ia-app://", store: SessionStore = KeychainSessionStore()) {
        self.siteURL = siteURL
        self.origin = origin
        self.store = store
        let configuration = URLSessionConfiguration.default
        configuration.httpShouldSetCookies = false
        self.urlSession = URLSession(configuration: configuration)
        if let jarData = store.data(forKey: Self.jarKey) {
            self.jar = CookieJar(serializedData: jarData) ?? CookieJar()
        }
        if let cacheData = store.data(forKey: Self.sessionCacheKey),
           let session = try? ConvexJSON.decode(cacheData)
        {
            self.cachedSessionJSON = session
        }
    }

    // MARK: API

    /// Signs in with the username plugin. Usernames are uppercased before
    /// sending, matching the Expo login screen behavior.
    @discardableResult
    public func signIn(username: String, password: String) async throws -> ConvexJSON {
        try await self.request(
            method: "POST",
            apiPath: "/api/auth/sign-in/username",
            bodyObject: [
                "username": .string(username.uppercased()),
                "password": .string(password)
            ]
        )
    }

    /// Returns the get-session payload ({user, session}) or null.
    @discardableResult
    public func currentSession(forceNetwork: Bool = false) async throws -> ConvexJSON? {
        if !forceNetwork, let cached = cachedSessionJSON {
            return cached
        }
        let payload = try await request(method: "GET", apiPath: "/api/auth/get-session")
        self.cachedSessionJSON = payload.isNull ? nil : payload
        self.persistSessionCache(payload.isNull ? nil : payload)
        return payload.isNull ? nil : payload
    }

    /// Short-lived JWT for Convex WebSocket authentication.
    public func convexToken(forceRefresh: Bool) async throws -> String {
        _ = forceRefresh // endpoint always mints fresh server-side
        let payload = try await request(method: "GET", apiPath: "/api/auth/convex/token")
        guard let token = payload["token"]?.stringValue else {
            throw BetterAuthError.missingField("token")
        }
        return token
    }

    public func signOut() async throws {
        _ = try? await self.request(method: "POST", apiPath: "/api/auth/sign-out", allowHTTPErrors: true)
        self.jar.clear()
        self.persistJar()
        self.cachedSessionJSON = nil
        self.persistSessionCache(nil)
    }

    /// Cached session snapshot used for instant restore at launch.
    public func cachedSession() -> ConvexJSON? {
        self.cachedSessionJSON
    }

    public func clearLocalState() {
        self.jar.clear()
        self.persistJar()
        self.cachedSessionJSON = nil
        self.persistSessionCache(nil)
    }

    // MARK: Transport

    @discardableResult
    private func request(
        method: String,
        apiPath: String,
        bodyObject: [String: ConvexJSON]? = nil,
        allowHTTPErrors: Bool = false
    ) async throws -> ConvexJSON {
        guard let url = URL(string: siteURL.absoluteString + apiPath) else {
            throw BetterAuthError.invalidURL(self.siteURL.absoluteString + apiPath)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(self.origin, forHTTPHeaderField: "expo-origin")
        request.setValue("true", forHTTPHeaderField: "x-skip-oauth-proxy")
        if let header = jar.headerValue() {
            request.setValue(header, forHTTPHeaderField: "cookie")
        }
        if let bodyObject {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? ConvexJSON.object(bodyObject).encodedData()
        }

        let (data, response) = try await urlSession.data(for: request)
        self.jar.absorb(response)
        self.persistJar()

        if let http = response as? HTTPURLResponse, !(200 ..< 300).contains(http.statusCode),
           !allowHTTPErrors
        {
            let message = (try? ConvexJSON.decode(data))?["message"]?.stringValue
                ?? (try? ConvexJSON.decode(data))?["code"]?.stringValue
            throw BetterAuthError.http(status: http.statusCode, message: message)
        }
        return (try? ConvexJSON.decode(data)) ?? .null
    }

    private func persistJar() {
        self.store.set(self.jar.serializedData(), forKey: Self.jarKey)
    }

    private func persistSessionCache(_ payload: ConvexJSON?) {
        if let payload, let data = try? payload.encodedData() {
            self.store.set(data, forKey: Self.sessionCacheKey)
        } else {
            self.store.set(nil, forKey: Self.sessionCacheKey)
        }
    }
}

// MARK: - JWT helpers

public enum JWTHelpers {
    /// Extracts the `exp` epoch-seconds claim without verifying the signature
    /// (verification is the server's job; this only schedules refreshes).
    public static func expiration(_ token: String) -> Date? {
        let parts = token.split(separator: ".")
        guard parts.count == 3,
              let payload = Data(base64URLEncoded: String(parts[1])),
              let json = try? JSONSerialization.jsonObject(with: payload),
              let object = json as? [String: Any],
              let exp = object["exp"] as? TimeInterval
        else {
            return nil
        }
        return Date(timeIntervalSince1970: exp)
    }
}

extension Data {
    /// Base64url decode with padding normalization (JWT segments).
    init?(base64URLEncoded segment: String) {
        var value = segment
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while value.count % 4 != 0 {
            value.append("=")
        }
        self.init(base64Encoded: value)
    }
}
