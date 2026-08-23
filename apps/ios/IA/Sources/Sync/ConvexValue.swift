import Foundation

/// A Convex value in its wire-JSON form (`convex@1.43.0` encodings).
///
/// Decoding accepts `$integer` / `$float` / `$bytes` / `$commitTs` wrappers;
/// encoding emits them per `values/value.ts`: Int64 always becomes
/// `{"$integer": base64LE}`, special doubles become `{"$float": ...}`,
/// bytes become `{"$bytes": ...}`. Object keys are emitted sorted
/// (JSONEncoder `.sortedKeys`) and must never begin with `$`.
public enum ConvexJSON: Sendable, Hashable {
    case null
    case bool(Bool)
    case double(Double)
    case int64(Int64)
    case string(String)
    case bytes(Data)
    case array([ConvexJSON])
    case object([String: ConvexJSON])

    // MARK: Decoding

    public static func decode(_ data: Data) throws -> ConvexJSON {
        let decoder = JSONDecoder()
        return try decoder.decode(ConvexJSON.self, from: data)
    }

    public init(from value: Any) throws {
        switch value {
        case is NSNull: self = .null
        case let n as NSNumber:
            self = ConvexJSON(number: n)
        case let s as String: self = .string(s)
        case let a as [Any]:
            self = try .array(a.map { try ConvexJSON(from: $0) })
        case let o as [String: Any]:
            var mapped: [String: ConvexJSON] = [:]
            mapped.reserveCapacity(o.count)
            for (k, v) in o {
                mapped[k] = try ConvexJSON(from: v)
            }
            self = .object(mapped)
        default:
            throw ConvexValueError.unsupportedSwiftValue(String(describing: type(of: value)))
        }
    }

    private init(number: NSNumber) {
        let objCType = String(cString: number.objCType)
        switch objCType {
        case "c", "B": self = .bool(number.boolValue)
        case "q", "l", "i", "s": self = .int64(number.int64Value)
        default: self = .double(number.doubleValue)
        }
    }

    // MARK: Encoding

    public func encodedData() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return try encoder.encode(self)
    }

    public func encodedString() throws -> String {
        try String(data: self.encodedData(), encoding: .utf8) ?? ""
    }

    /// Convenience for building argument objects.
    public static func object(_ pairs: (String, ConvexJSON)...) -> ConvexJSON {
        .object(Dictionary(uniqueKeysWithValues: pairs))
    }

    public static func args(_ object: [String: ConvexJSON]) -> ConvexJSON {
        .array([.object(object)])
    }

    // MARK: Typed accessors (model building)

    public var isNull: Bool {
        if case .null = self {
            return true
        }; return false
    }

    public var stringValue: String? {
        if case .string(let s) = self {
            return s
        }
        return nil
    }

    public var boolValue: Bool? {
        if case .bool(let b) = self {
            return b
        }
        return nil
    }

    /// Accepts either numeric encoding for integers.
    public var int64Value: Int64? {
        switch self {
        case .int64(let i): i
        case .double(let d): d == d.rounded() ? Int64(exactly: d) : nil
        default: nil
        }
    }

    public var doubleValue: Double? {
        switch self {
        case .double(let d): d
        case .int64(let i): Double(i)
        default: nil
        }
    }

    public var arrayValue: [ConvexJSON]? {
        if case .array(let a) = self {
            return a
        }
        return nil
    }

    public var objectValue: [String: ConvexJSON]? {
        if case .object(let o) = self {
            return o
        }
        return nil
    }

    public subscript(key: String) -> ConvexJSON? {
        if case .object(let o) = self {
            return o[key]
        }
        return nil
    }

    public func require(_ key: String) throws -> ConvexJSON {
        guard let value = self[key] else { throw ConvexValueError.missingField(key) }
        return value
    }

    public func string(_ key: String) throws -> String {
        guard let value = try require(key).stringValue else {
            throw ConvexValueError.badField(key, expected: "string")
        }
        return value
    }

    public func optionalString(_ key: String) -> String? {
        guard let value = self[key], !value.isNull else { return nil }
        return value.stringValue
    }

    public func bool(_ key: String, fallback: Bool = false) -> Bool {
        guard let value = self[key], !value.isNull else { return fallback }
        return value.boolValue ?? fallback
    }

    public func int64(_ key: String, fallback: Int64 = 0) -> Int64 {
        guard let value = self[key], !value.isNull else { return fallback }
        return value.int64Value ?? fallback
    }

    public func array(_ key: String) -> [ConvexJSON] {
        guard let value = self[key], !value.isNull else { return [] }
        return value.arrayValue ?? []
    }

    public func iso8601(_ key: String) -> Date? {
        self.optionalString(key).flatMap { ConvexJSON.isoFormatter.date(from: $0) }
    }

    /// ISO8601DateFormatter's parse/format entry points are thread-safe;
    /// sharing one instance avoids per-call allocation.
    private nonisolated(unsafe) static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

public enum ConvexValueError: Error, CustomStringConvertible {
    case missingField(String)
    case badField(String, expected: String)
    case badBase64(String)
    case unsupportedSwiftValue(String)

    public var description: String {
        switch self {
        case .missingField(let k): "missing field \(k)"
        case .badField(let k, let e): "field \(k) is not \(e)"
        case .badBase64(let s): "bad base64 timestamp \(s)"
        case .unsupportedSwiftValue(let t): "unsupported value type \(t)"
        }
    }
}

// MARK: - Codable (wire form)

extension ConvexJSON: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
            return
        }
        if let b = try? container.decode(Bool.self) {
            self = .bool(b)
            return
        }
        if let s = try? container.decode(String.self) {
            self = .string(s)
            return
        }
        if let dict = try? container.decode([String: ConvexJSON].self) {
            self = try ConvexJSON(wireObject: dict)
            return
        }
        if let array = try? container.decode([ConvexJSON].self) {
            self = .array(array)
            return
        }
        if let d = try? container.decode(Double.self) {
            self = .double(d)
            return
        }
        throw ConvexValueError.badField("<root>", expected: "json value")
    }

    /// Interprets `{"$integer": "..."} / {"$float": "..."} / {"$bytes": "..."}`
    /// wrappers; otherwise a plain object.
    private init(wireObject dict: [String: ConvexJSON]) throws {
        if dict.count == 1, let key = dict.keys.first, key.hasPrefix("$") {
            switch key {
            case "$integer":
                guard let encoded = dict[key]?.stringValue,
                      let value = ConvexTS.decodeInteger(encoded)
                else {
                    throw ConvexValueError.badBase64(dict[key]?.stringValue ?? "")
                }
                self = .int64(value)
                return
            case "$float":
                guard let encoded = dict[key]?.stringValue,
                      let value = ConvexTS.decodeDouble(encoded)
                else {
                    throw ConvexValueError.badBase64(dict[key]?.stringValue ?? "")
                }
                self = .double(value)
                return
            case "$bytes":
                guard let encoded = dict[key]?.stringValue, let data = Data(base64Encoded: encoded) else {
                    throw ConvexValueError.badBase64(dict[key]?.stringValue ?? "")
                }
                self = .bytes(data)
                return
            case "$commitTs":
                self = .null
                return
            default:
                break
            }
        }
        self = .object(dict)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let b): try container.encode(b)
        case .string(let s): try container.encode(s)
        case .int64(let i): try container.encode(["$integer": ConvexTS.encodeInteger(i)])
        case .double(let d):
            if d.isFinite {
                try container.encode(d)
            } else {
                try container.encode(["$float": ConvexTS.encodeDouble(d)])
            }
        case .bytes(let data): try container.encode(["$bytes": data.base64EncodedString()])
        case .array(let a): try container.encode(a)
        case .object(let o):
            try container.encode(o)
        }
    }
}

// MARK: - Timestamps (base64 little-endian u64)

public enum ConvexTS {
    /// Decodes a wire `TS` / `$integer` payload: base64 of 8-byte LE integer.
    public static func decodeInteger(_ base64: String) -> Int64? {
        guard let data = Data(base64Encoded: base64), data.count == 8 else { return nil }
        var value: UInt64 = 0
        for byte in data.reversed() {
            value = (value << 8) | UInt64(byte)
        }
        return Int64(bitPattern: value)
    }

    public static func encodeInteger(_ value: Int64) -> String {
        var bits = UInt64(bitPattern: value)
        var bytes = [UInt8]()
        bytes.reserveCapacity(8)
        for _ in 0 ..< 8 {
            bytes.append(UInt8(bits & 0xFF))
            bits >>= 8
        }
        return Data(bytes).base64EncodedString()
    }

    public static func decodeUnsigned(_ base64: String) -> UInt64? {
        guard let data = Data(base64Encoded: base64), data.count == 8 else { return nil }
        var value: UInt64 = 0
        for byte in data.reversed() {
            value = (value << 8) | UInt64(byte)
        }
        return value
    }

    public static func encodeUnsigned(_ value: UInt64) -> String {
        var bits = value
        var bytes = [UInt8]()
        bytes.reserveCapacity(8)
        for _ in 0 ..< 8 {
            bytes.append(UInt8(bits & 0xFF))
            bits >>= 8
        }
        return Data(bytes).base64EncodedString()
    }

    static func decodeDouble(_ base64: String) -> Double? {
        guard let data = Data(base64Encoded: base64), data.count == 8 else { return nil }
        return data.withUnsafeBytes { buffer -> Double in
            let bits = UInt64(littleEndian: buffer.load(as: UInt64.self))
            return Double(bitPattern: bits)
        }
    }

    static func encodeDouble(_ value: Double) -> String {
        let bits = value.bitPattern.littleEndian
        return withUnsafeBytes(of: bits) { Data($0) }.base64EncodedString()
    }
}

// MARK: - Pagination results

/// Standard Convex reactive-pagination payload.
public struct ConvexPage<T: Sendable>: Sendable {
    public let items: [T]
    public let isDone: Bool
    public let continueCursor: String?
    public let splitCursor: String?
    public let pageStatus: String?

    public static func decode(
        _ json: ConvexJSON,
        item: (ConvexJSON) throws -> T
    ) throws -> ConvexPage<T> {
        try ConvexPage(
            items: json.array("page").map(item),
            isDone: json.bool("isDone"),
            continueCursor: json.optionalString("continueCursor"),
            splitCursor: json.optionalString("splitCursor"),
            pageStatus: json.optionalString("pageStatus")
        )
    }
}
