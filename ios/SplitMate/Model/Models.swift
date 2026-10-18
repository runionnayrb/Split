import Foundation

enum Payer: String, CaseIterable, Identifiable {
    /// "me" is always partner 1 and "spouse" partner 2, matching the web app.
    case me, spouse
    var id: String { rawValue }
    var other: Payer { self == .me ? .spouse : .me }
}

struct FriendSplit: Equatable {
    var name: String
    var amount: Double
    var shareType: String   // "amount" | "percent"
    var shareInput: Double

    var json: JSONValue {
        .object([
            "name": .string(name),
            "amount": .number(amount),
            "shareType": .string(shareType),
            "shareInput": .number(shareInput),
        ])
    }

    init(name: String, amount: Double, shareType: String, shareInput: Double) {
        self.name = name; self.amount = amount; self.shareType = shareType; self.shareInput = shareInput
    }

    init?(_ value: JSONValue?) {
        guard let o = value?.object, let name = o["name"]?.string, let amount = o["amount"]?.double else { return nil }
        self.init(name: name, amount: amount, shareType: o["shareType"]?.string ?? "amount",
                  shareInput: o["shareInput"]?.double ?? amount)
    }
}

/// A transaction as the web app stores it, with typed accessors over the raw JSON.
struct Transaction: Identifiable, Equatable {
    var raw: [String: JSONValue]

    var id: String { raw["id"]?.string ?? "" }

    var amount: Double {
        get { raw["amount"]?.double ?? 0 }
        set { raw["amount"] = .number(newValue) }
    }
    var notes: String {
        get { raw["notes"]?.string ?? "" }
        set { raw["notes"] = .string(newValue) }
    }
    var payer: Payer {
        get { Payer(rawValue: raw["whoPaid"]?.string ?? "") ?? .me }
        set { raw["whoPaid"] = .string(newValue.rawValue) }
    }
    var category: Category {
        get { Category(raw: raw["category"]?.string) }
        set { raw["category"] = .string(newValue.rawValue) }
    }
    var date: Date {
        get { ISODate.parse(raw["date"]?.string) ?? .distantPast }
        set { raw["date"] = .string(ISODate.string(newValue)) }
    }
    var youOwe: Double {
        get { raw["youOwe"]?.double ?? 0 }
        set { raw["youOwe"] = .number(newValue) }
    }
    var isSettled: Bool { raw["settled"]?.bool ?? false }
    var settledDate: Date? { ISODate.parse(raw["settledDate"]?.string) }
    var isFromReceipt: Bool { raw["isFromReceipt"]?.bool ?? false }
    var isPersonal: Bool { raw["scope"]?.string == "personal" }
    var friendSplit: FriendSplit? { FriendSplit(raw["friendSplit"]) }

    var title: String { notes.isEmpty ? category.title : notes }

    /// Data-URL receipt photo, if one was attached.
    var receiptImageData: Data? {
        guard let s = raw["receiptImage"]?.string, s.hasPrefix("data:"),
              let comma = s.firstIndex(of: ",") else { return nil }
        return Data(base64Encoded: String(s[s.index(after: comma)...]))
    }

    /// What the non-paying partner owes the payer for this expense.
    var partnerShare: Double {
        if isFromReceipt, let bd = raw["receiptBreakdown"]?.object {
            let key = payer == .me ? "ayakoTotal" : "bryanTotal"
            if let v = bd[key]?.double { return v }
        }
        if isFromReceipt, youOwe != 0 { return abs(youOwe) }
        return amount / 2
    }

    mutating func settle() {
        raw["youOwe"] = .int(0)
        raw["settled"] = .bool(true)
        raw["settledDate"] = .string(ISODate.string(Date()))
    }

    /// Mirrors the web app's edit: always 50/50, and a receipt whose amount changed
    /// loses its itemized breakdown.
    mutating func applyEdit(notes: String, amount: Double, category: Category, payer: Payer, date: Date) {
        let amountChanged = abs(amount - self.amount) > 0.001
        if !notes.trimmingCharacters(in: .whitespaces).isEmpty { self.notes = notes }
        self.amount = amount
        self.category = category
        self.payer = payer
        self.date = date
        if !isSettled { youOwe = amount / 2 }
        if amountChanged && isFromReceipt {
            raw["isFromReceipt"] = .bool(false)
            raw["receiptBreakdown"] = .null
        }
    }

    static func manual(amount: Double, notes: String, category: Category, payer: Payer, friend: FriendSplit?) -> Transaction {
        Transaction(raw: [
            "id": .int(Int(Date().timeIntervalSince1970 * 1000)),
            "date": .string(ISODate.string(Date())),
            "whoPaid": .string(payer.rawValue),
            "amount": .number(amount),
            "category": .string(category.rawValue),
            "notes": .string(notes),
            "youOwe": .number(payer == .spouse ? amount / 2 : -(amount / 2)),
            "friendSplit": friend?.json ?? .null,
            "scope": .string(friend == nil ? "shared" : "personal"),
        ])
    }
}

enum ISODate {
    private static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let plain = ISO8601DateFormatter()

    static func string(_ date: Date) -> String { withFraction.string(from: date) }
    static func parse(_ s: String?) -> Date? {
        guard let s else { return nil }
        return withFraction.date(from: s) ?? plain.date(from: s)
    }
}

struct User: Codable, Equatable {
    var id: Int
    var email: String
    var p1Name: String?
    var p2Name: String?
}

struct PaymentSettings: Codable, Equatable {
    struct CashApp: Codable, Equatable { var enabled = false; var tag = "" }
    struct Venmo: Codable, Equatable { var enabled = false; var username = "" }
    struct Zelle: Codable, Equatable { var enabled = false; var phone = "" }

    var cashapp = CashApp()
    var venmo = Venmo()
    var zelle = Zelle()

    init() {}
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        cashapp = (try? c.decode(CashApp.self, forKey: .cashapp)) ?? CashApp()
        venmo = (try? c.decode(Venmo.self, forKey: .venmo)) ?? Venmo()
        zelle = (try? c.decode(Zelle.self, forKey: .zelle)) ?? Zelle()
    }

    var hasAny: Bool {
        (cashapp.enabled && !cashapp.tag.isEmpty) || (venmo.enabled && !venmo.username.isEmpty)
            || (zelle.enabled && !zelle.phone.isEmpty)
    }

    var cashTag: String {
        var t = cashapp.tag.trimmingCharacters(in: .whitespaces)
        t = t.replacingOccurrences(of: #"^https?://"#, with: "", options: [.regularExpression, .caseInsensitive])
        t = t.replacingOccurrences(of: #"^cash\.app/"#, with: "", options: [.regularExpression, .caseInsensitive])
        if t.hasPrefix("$") { t.removeFirst() }
        return t
    }

    func cashAppURL(amount: Double) -> URL? {
        guard cashapp.enabled, !cashTag.isEmpty else { return nil }
        return URL(string: "https://cash.app/$\(cashTag)/\(String(format: "%.2f", amount))")
    }

    func venmoURL(amount: Double, note: String) -> URL? {
        guard venmo.enabled, !venmo.username.isEmpty else { return nil }
        var c = URLComponents(string: "venmo://paycharge")!
        c.queryItems = [
            .init(name: "txn", value: "pay"),
            .init(name: "recipients", value: venmo.username),
            .init(name: "amount", value: String(format: "%.2f", amount)),
            .init(name: "note", value: note.isEmpty ? "SplitMate expense" : note),
        ]
        return c.url
    }

    var zelleDisplay: String? {
        guard zelle.enabled, !zelle.phone.isEmpty else { return nil }
        let digits = zelle.phone.filter(\.isNumber)
        guard digits.count == 10 else { return zelle.phone }
        let a = digits.prefix(3), b = digits.dropFirst(3).prefix(3), c = digits.suffix(4)
        return "(\(a)) \(b)-\(c)"
    }
}

struct PartnerStatus: Codable, Equatable {
    struct Partner: Codable, Equatable { var id: Int; var email: String }
    var linked: Bool
    var partner: Partner?
    var inviteCode: String?
}

struct ReceiptData: Codable {
    struct Item: Codable, Identifiable {
        var id = UUID()
        var name: String
        var price: Double
        var category: String?
        enum CodingKeys: String, CodingKey { case name, price, category }
    }
    var items: [Item]
    var subtotal: Double?
    var tax: Double?
    var tip: Double?
    var fees: Double?
    var total: Double?
    var merchant: String?

    var feesTotal: Double { (tax ?? 0) + (tip ?? 0) + (fees ?? 0) }
}
