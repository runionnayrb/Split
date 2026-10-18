import Foundation

/// Loosely-typed JSON. Transactions are stored as JSON objects so that fields the
/// web app writes (receiptBreakdown, receiptImage, ...) survive a round trip
/// through the iOS app untouched.
enum JSONValue: Codable, Equatable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Int.self) { self = .int(v) }
        else if let v = try? c.decode(Double.self) { self = .double(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .int(let v): try c.encode(v)
        case .double(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }

    var double: Double? {
        switch self {
        case .int(let v): Double(v)
        case .double(let v): v
        case .string(let v): Double(v)
        default: nil
        }
    }

    var string: String? {
        switch self {
        case .string(let v): v
        case .int(let v): String(v)
        case .double(let v): String(v)
        default: nil
        }
    }

    var bool: Bool? {
        if case .bool(let v) = self { return v }
        return nil
    }

    var object: [String: JSONValue]? {
        if case .object(let v) = self { return v }
        return nil
    }

    static func number(_ value: Double) -> JSONValue {
        value == value.rounded() && abs(value) < 1e15 ? .int(Int(value)) : .double(value)
    }
}
