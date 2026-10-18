import Foundation

struct APIError: LocalizedError {
    let message: String
    let status: Int
    var errorDescription: String? { message }
    var isUnauthorized: Bool { status == 401 }
}

/// Talks to the same server the web app uses, so both stay in sync.
struct APIClient {
    static let baseURL = URL(string: "https://split-mate.replit.app")!

    var token: String?

    private struct Empty: Encodable {}
    private struct AuthResponse: Decodable { let token: String; let user: User }
    private struct MeResponse: Decodable { let user: User }
    private struct TransactionsResponse: Decodable { let transactions: [[String: JSONValue]] }
    private struct SettingsResponse: Decodable { let settings: PaymentSettings }
    private struct CodeResponse: Decodable { let code: String }
    private struct Ignored: Decodable {}

    // MARK: Auth

    func login(email: String, password: String) async throws -> (String, User) {
        let r: AuthResponse = try await send("POST", "/api/auth/login", body: ["email": email, "password": password])
        return (r.token, r.user)
    }

    func register(email: String, password: String, p1Name: String, p2Name: String) async throws -> (String, User) {
        let r: AuthResponse = try await send("POST", "/api/auth/register",
                                             body: ["email": email, "password": password, "p1Name": p1Name, "p2Name": p2Name])
        return (r.token, r.user)
    }

    func me() async throws -> User {
        let r: MeResponse = try await send("GET", "/api/auth/me")
        return r.user
    }

    func updateNames(p1: String, p2: String) async throws {
        let _: Ignored = try await send("PUT", "/api/auth/profile", body: ["p1Name": p1, "p2Name": p2])
    }

    // MARK: Transactions

    func transactions() async throws -> [Transaction] {
        let r: TransactionsResponse = try await send("GET", "/api/userdata")
        return r.transactions.map(Transaction.init(raw:))
    }

    func save(_ transactions: [Transaction]) async throws {
        let body = ["transactions": JSONValue.array(transactions.map { .object($0.raw) })]
        let _: Ignored = try await send("POST", "/api/userdata", body: body)
    }

    // MARK: Payment settings

    func paymentSettings() async throws -> PaymentSettings {
        let r: SettingsResponse = try await send("GET", "/api/payment-settings")
        return r.settings
    }

    func savePaymentSettings(_ s: PaymentSettings) async throws {
        let _: Ignored = try await send("PUT", "/api/payment-settings", body: s)
    }

    // MARK: Partner

    func partnerStatus() async throws -> PartnerStatus { try await send("GET", "/api/partner/status") }

    func createInvite() async throws -> String {
        let r: CodeResponse = try await send("POST", "/api/partner/invite", body: Empty())
        return r.code
    }

    func acceptInvite(_ code: String) async throws {
        let _: Ignored = try await send("POST", "/api/partner/accept", body: ["code": code])
    }

    func unlinkPartner() async throws {
        let _: Ignored = try await send("DELETE", "/api/partner/unlink")
    }

    // MARK: Receipts

    func processReceipt(jpegBase64: String) async throws -> ReceiptData {
        try await send("POST", "/api/process-receipt",
                       body: ["image": JSONValue.string(jpegBase64), "isPdf": .bool(false)], timeout: 120)
    }

    // MARK: Plumbing

    private func send<T: Decodable>(_ method: String, _ path: String, body: (any Encodable)? = nil,
                                    timeout: TimeInterval = 30) async throws -> T {
        var req = URLRequest(url: Self.baseURL.appending(path: path), timeoutInterval: timeout)
        req.httpMethod = method
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError(message: message ?? "Something went wrong (\(status)). Please try again.", status: status)
        }
        if T.self == Ignored.self { return Ignored() as! T }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
