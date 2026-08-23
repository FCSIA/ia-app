import Foundation
@testable import IA
import Testing

// MARK: - Wire encoding

struct WireEncodingTests {
    @Test
    func connectFrameHasExactFields() throws {
        let message = SyncOutboundMessage.connect(
            sessionId: "11111111-2222-3333-4444-555555555555",
            connectionCount: 0,
            lastCloseReason: "InitialConnect",
            maxObservedTimestamp: nil,
            clientTs: 1_771_849_200_000
        )
        let json = try Self.dictionary(from: message)
        #expect(json["type"] as? String == "Connect")
        #expect(json["sessionId"] as? String == "11111111-2222-3333-4444-555555555555")
        #expect(json["connectionCount"] as? Int == 0)
        #expect(json["lastCloseReason"] as? String == "InitialConnect")
        #expect(json["clientTs"] as? Int == 1_771_849_200_000)
        #expect(json["maxObservedTimestamp"] == nil)
    }

    @Test
    func modifyQuerySetWrapsArgsInSingleElementArray() throws {
        let modification = QuerySetModification.add(
            queryId: 0,
            udfPath: "clubs/channels:list",
            args: .args(["channelId": .string("k57")]),
            journal: ""
        )
        let message = SyncOutboundMessage.modifyQuerySet(
            baseVersion: 0,
            newVersion: 1,
            modifications: [modification]
        )
        let json = try Self.dictionary(from: message)
        #expect(json["type"] as? String == "ModifyQuerySet")
        #expect(json["baseVersion"] as? Int == 0)
        let modifications = try #require(json["modifications"] as? [[String: Any]])
        let add = try #require(modifications.first)
        #expect(add["type"] as? String == "Add")
        #expect(add["udfPath"] as? String == "clubs/channels:list")
        // Journal key is always present on Add (null when empty).
        #expect(add["journal"] != nil)
        let args = try #require(add["args"] as? [[String: Any]])
        #expect(args.count == 1)
        let argsObject = try #require(args.first?["channelId"] as? String)
        #expect(argsObject == "k57")
    }

    @Test
    func mutationFrameUsesVerbatimPathAndWrappedArgs() throws {
        let message = SyncOutboundMessage.mutation(
            requestId: 3,
            udfPath: "clubs/channels:postMessage",
            args: .args(["channelId": .string("c1"), "body": .string("hi")])
        )
        let json = try Self.dictionary(from: message)
        #expect(json["type"] as? String == "Mutation")
        #expect(json["requestId"] as? Int == 3)
        #expect(json["udfPath"] as? String == "clubs/channels:postMessage")
        let args = try #require(json["args"] as? [[String: Any]])
        #expect(args.count == 1)
    }

    private static func dictionary(from value: some Encodable) throws -> [String: Any] {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(value)
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any])
    }
}

// MARK: - Value codecs

struct ConvexValueTests {
    @Test
    func unsignedTimestampsRoundTrip() {
        let values: [UInt64] = [0, 1, 1234, UInt64(Int64.max), UInt64.max]
        for value in values {
            let encoded = ConvexTS.encodeUnsigned(value)
            #expect(encoded.count > 0)
            #expect(ConvexTS.decodeUnsigned(encoded) == value)
        }
    }

    @Test
    func integerWrapperDecodes() throws {
        let encoded = ConvexTS.encodeInteger(-42)
        let wrapper = "{\"$integer\":\"\(encoded)\"}"
        let decoded = try ConvexJSON.decode(Data(wrapper.utf8))
        #expect(decoded.int64Value == -42)
    }

    @Test
    func specialFloatsUseFloatWrapper() throws {
        let nanJSON = try ConvexJSON.double(.nan).encodedData()
        let decoded = try ConvexJSON.decode(nanJSON)
        guard case .double(let value) = decoded else {
            Issue.record("expected double")
            return
        }
        #expect(value.isNaN)
    }

    @Test
    func plainJSONPassesThrough() throws {
        let payload = """
        {"name":"club","active":true,"score":3.5,"tags":["a","b"],"meta":null}
        """
        let decoded = try ConvexJSON.decode(Data(payload.utf8))
        #expect(decoded["name"]?.stringValue == "club")
        #expect(decoded["active"]?.boolValue == true)
        #expect(decoded["score"]?.doubleValue == 3.5)
        #expect(decoded["tags"]?.arrayValue?.count == 2)
        #expect(decoded["meta"]?.isNull == true)
    }
}

// MARK: - Inbound decoding

struct InboundDecodingTests {
    @Test
    func transitionDecodesWithTimestamps() throws {
        let ts = ConvexTS.encodeUnsigned(1234)
        let payload = """
        {"type":"Transition",
         "startVersion":{"querySet":1,"ts":"\(ts)","identity":1},
         "endVersion":{"querySet":1,"ts":"\(ts)","identity":2},
         "modifications":[{"type":"QueryUpdated","queryId":0,"value":{"page":[],"isDone":true,"continueCursor":null},"logLines":[],"journal":null}]}
        """
        let message = try JSONDecoder().decode(SyncInboundMessage.self, from: Data(payload.utf8))
        guard case .transition(let transition) = message else {
            Issue.record("expected transition, got \(message)")
            return
        }
        #expect(transition.startVersion.ts == 1234)
        #expect(transition.endVersion.identity == 2)
        guard case .updated(let updated) = transition.modifications.first else {
            Issue.record("expected updated modification")
            return
        }
        #expect(updated.queryId == 0)
        #expect(updated.value?["isDone"]?.boolValue == true)
        #expect(updated.journal == nil, "null journal must stay nil, not empty string")
    }

    @Test
    func transitionPreservesNonEmptyJournal() throws {
        let ts = ConvexTS.encodeUnsigned(9)
        let payload = """
        {"type":"Transition",
         "startVersion":{"querySet":1,"ts":"\(ts)","identity":1},
         "endVersion":{"querySet":1,"ts":"\(ts)","identity":1},
         "modifications":[{"type":"QueryUpdated","queryId":2,
           "value":{"page":[],"isDone":true,"continueCursor":"cursor-1"},
           "logLines":[],"journal":"{\\"cursor\\":\\"cursor-1\\"}"}]}
        """
        let message = try JSONDecoder().decode(SyncInboundMessage.self, from: Data(payload.utf8))
        guard case .transition(let transition) = message,
              case .updated(let updated) = transition.modifications.first
        else {
            Issue.record("expected transition with updated modification")
            return
        }
        #expect(updated.journal == "{\"cursor\":\"cursor-1\"}")
        #expect(updated.value?["continueCursor"]?.stringValue == "cursor-1")
    }

    @Test
    func mutationFailureCarriesErrorData() throws {
        let payload = """
        {"type":"MutationResponse","requestId":7,"success":false,
         "result":"Reaction is not supported","logLines":[],
         "errorData":{"code":"BAD_REACTION"}}
        """
        let message = try JSONDecoder().decode(SyncInboundMessage.self, from: Data(payload.utf8))
        guard case .mutationResponse(let response) = message else {
            Issue.record("expected mutation response")
            return
        }
        #expect(!response.success)
        #expect(response.errorMessage == "Reaction is not supported")
        #expect(response.errorData?["code"]?.stringValue == "BAD_REACTION")
    }

    @Test
    func chunkBufferReassemblesInOrderAndRejectsGaps() {
        var buffer = TransitionChunkBuffer()
        func frame(_ id: String, _ partNumber: Int, _ total: Int, _ chunk: String) -> String {
            """
            {"type":"TransitionChunk","chunk":"\(chunk)","partNumber":\(partNumber),"totalParts":\(total),"transitionId":"\(id)"}
            """
        }
        // In-order assembly.
        #expect(buffer.absorb(frame("t1", 0, 3, "hel")) == nil)
        #expect(buffer.absorb(frame("t1", 1, 3, "lo wor")) == nil)
        #expect(buffer.absorb(frame("t1", 2, 3, "ld")) == "hello world")

        // A gap aborts the stream; later parts never recover it.
        #expect(buffer.absorb(frame("t2", 0, 3, "A")) == nil)
        #expect(buffer.absorb(frame("t2", 2, 3, "C")) == nil)
        #expect(buffer.absorb(frame("t2", 1, 3, "B")) == nil)
        // Only a fresh part-0 starts a new assembly.
        #expect(buffer.absorb(frame("t3", 0, 2, "x")) == nil)
        #expect(buffer.absorb(frame("t3", 1, 2, "y")) == "xy")
    }
}

// MARK: - Cookie jar

struct CookieJarTests {
    @Test
    func splitMergedSetCookieKeepsDateCommas() {
        let merged = "session=abc; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, other=xyz; Path=/"
        let parts = CookieJar.splitSetCookieHeaders(merged)
        #expect(parts.count == 2)
        #expect(parts[0].hasPrefix("session=abc"))
        #expect(parts[0].contains("07:28:00 GMT"))
        #expect(parts[1].trimmingCharacters(in: .whitespaces).hasPrefix("other=xyz"))
    }

    @Test
    func absorbsAndExpiresCookies() throws {
        var jar = CookieJar()
        let fakeURL = try #require(URL(string: "https://ia.local"))
        let future = try #require(Calendar.current.date(byAdding: .hour, value: 1, to: Date()))
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let response = try #require(HTTPURLResponse(
            url: fakeURL,
            statusCode: 200,
            httpVersion: nil,
            headerFields: [
                "Set-Cookie": "keep=1; Expires=\(formatter.string(from: future)); Path=/"
            ]
        ))
        jar.absorb(response)
        #expect(jar.headerValue()?.contains("keep=1") == true)

        let expired = try #require(HTTPURLResponse(
            url: fakeURL,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Set-Cookie": "keep=; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]
        ))
        jar.absorb(expired)
        #expect(jar.headerValue()?.contains("keep=") != true)
    }

    @Test
    func serializesAndRestores() throws {
        var jar = CookieJar()
        jar.applySetCookie("alpha=one; Path=/")
        jar.applySetCookie("beta=two; Path=/")
        let restored = CookieJar(serializedData: jar.serializedData())
        let header = try #require(restored?.headerValue())
        #expect(header.contains("alpha=one"))
        #expect(header.contains("beta=two"))
    }
}

// MARK: - JWT

struct JWTTests {
    @Test
    func extractsExpirationFromTokenShape() {
        // header.payload.signature with exp in payload
        let payload = Data("{\"exp\":1893456000,\"sub\":\"u1\"}".utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
        let token = "eyJhbGciOiJIUzI1NiJ9.\(payload).sig"
        let expiration = JWTHelpers.expiration(token)
        #expect(expiration?.timeIntervalSince1970 == 1_893_456_000)
    }
}
