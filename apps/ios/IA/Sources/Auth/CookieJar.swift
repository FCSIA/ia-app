import Foundation

/// Name-keyed cookie jar mirroring the @better-auth/expo client: cookies are
/// stored per name across paths/domains, expired entries are dropped, and the
/// whole jar serializes to JSON for durable storage.
public struct CookieJar: Sendable, Equatable {
    struct StoredCookie: Codable, Sendable, Equatable {
        var name: String
        var value: String
        var expiresAt: Date?
    }

    private var cookies: [String: StoredCookie] = [:]

    public init() {}

    /// Restores from persisted JSON produced by `serializedData()`.
    public init?(serializedData: Data?) {
        guard let data = serializedData,
              let list = try? JSONDecoder().decode([StoredCookie].self, from: data)
        else {
            return nil
        }
        var map: [String: StoredCookie] = [:]
        for cookie in list where !cookie.name.isEmpty {
            map[cookie.name] = cookie
        }
        self.cookies = map
        self.pruneExpired()
    }

    public var isEmpty: Bool {
        self.cookies.isEmpty
    }

    /// Consumes Set-Cookie headers from a response.
    public mutating func absorb(_ response: URLResponse) {
        guard let http = response as? HTTPURLResponse else { return }
        for (key, value) in http.allHeaderFields {
            guard let fieldName = key as? String, fieldName.lowercased() == "set-cookie",
                  let headerText = value as? String else { continue }
            for part in Self.splitSetCookieHeaders(headerText) {
                self.applySetCookie(part)
            }
        }
        self.pruneExpired()
    }

    mutating func applySetCookie(_ headerText: String) {
        let segments = headerText.components(separatedBy: ";").map {
            $0.trimmingCharacters(in: .whitespaces)
        }
        guard let nameValue = segments.first, let equals = nameValue.firstIndex(of: "=") else {
            return
        }
        let name = String(nameValue[..<equals]).trimmingCharacters(in: .whitespaces)
        let value = String(nameValue[nameValue.index(after: equals)...])
        guard !name.isEmpty else { return }

        var expiresAt: Date?
        for attribute in segments.dropFirst() {
            let lowered = attribute.lowercased()
            if lowered.hasPrefix("expires=") {
                let rawDate = attribute.dropFirst("expires=".count)
                    .trimmingCharacters(in: .whitespaces)
                expiresAt = Self.parseHTTPDate(rawDate)
            } else if lowered.hasPrefix("max-age=") {
                let rawSeconds = attribute.dropFirst("max-age=".count)
                    .trimmingCharacters(in: .whitespaces)
                if let seconds = Int(rawSeconds) {
                    expiresAt = seconds <= 0 ? .distantPast : Date().addingTimeInterval(TimeInterval(seconds))
                }
            }
        }

        if let expiresAt, expiresAt <= Date() {
            self.cookies.removeValue(forKey: name)
        } else {
            self.cookies[name] = StoredCookie(name: name, value: value, expiresAt: expiresAt)
        }
    }

    private static func parseHTTPDate(_ value: String) -> Date? {
        // RFC 1123 ("Sun, 06 Nov 1994 08:49:37 GMT") and the older RFC 1036/
        // asctime dash variant ("Sun, 06-Nov-1994 08:49:37 GMT").
        for formatter in self.httpDateFormatters {
            if let date = formatter.date(from: value) {
                return date
            }
        }
        return nil
    }

    private static let httpDateFormatters: [DateFormatter] = {
        let rfc1123 = DateFormatter()
        rfc1123.locale = Locale(identifier: "en_US_POSIX")
        rfc1123.timeZone = TimeZone(identifier: "GMT")
        rfc1123.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        let dashed = DateFormatter()
        dashed.locale = Locale(identifier: "en_US_POSIX")
        dashed.timeZone = TimeZone(identifier: "GMT")
        dashed.dateFormat = "EEE, dd-MMM-yyyy HH:mm:ss zzz"
        return [rfc1123, dashed]
    }()

    public func headerValue() -> String? {
        let live = self.cookies.values.filter { $0.expiresAt.map { $0 > Date() } ?? true }
        guard !live.isEmpty else { return nil }
        return live
            .sorted(by: { $0.name < $1.name })
            .map { "\($0.name)=\($0.value)" }
            .joined(separator: "; ")
    }

    /// Clears every entry (sign-out).
    public mutating func clear() {
        self.cookies.removeAll()
    }

    public func serializedData() -> Data? {
        let list = self.cookies.values.sorted(by: { $0.name < $1.name })
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(list)
    }

    private mutating func pruneExpired() {
        let now = Date()
        self.cookies = self.cookies.filter { _, cookie in
            cookie.expiresAt.map { $0 > now } ?? true
        }
    }

    /// URLSession may merge multiple Set-Cookie headers into one comma-joined
    /// string. Split top-level commas while keeping date values intact
    /// ("Expires=Wed, 21 Oct ..."). A fragment that starts like a date
    /// continuation is rejoined into the previous cookie.
    static func splitSetCookieHeaders(_ text: String) -> [String] {
        let pieces = text.components(separatedBy: ",")
        var results: [String] = []
        var current = ""

        func looksLikeDateContinuation(_ fragment: String) -> Bool {
            // Merged-header continuations always follow ", " and begin with a
            // day number or weekday; real cookies begin with "name=".
            guard fragment.first == " " || fragment.first == "\t" else { return false }
            let trimmed = fragment.trimmingCharacters(in: .whitespaces)
            let firstWord = trimmed.split(separator: " ").first.map(String.init) ?? ""
            if Int(firstWord) != nil || Self.weekdayNames.contains(firstWord) {
                return true
            }
            return false
        }

        for piece in pieces {
            if !current.isEmpty, looksLikeDateContinuation(piece) {
                current += "," + piece
            } else {
                if !current.isEmpty {
                    results.append(current)
                }
                current = piece
            }
        }
        if !current.isEmpty {
            results.append(current)
        }
        return results.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private static let weekdayNames: Set<String> = [
        "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
    ]
}
