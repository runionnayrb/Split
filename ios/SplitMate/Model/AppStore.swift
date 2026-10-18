import Foundation
import SwiftUI

/// App-wide state: who is signed in, their transactions, and their settings.
/// Every change to transactions is saved back to the server (or to disk in guest mode).
@MainActor
@Observable
final class AppStore {
    enum Session: Equatable { case loading, signedOut, guest, signedIn }

    private(set) var session: Session = .loading
    private(set) var user: User?
    private(set) var transactions: [Transaction] = []
    var paymentSettings = PaymentSettings()
    private(set) var partnerStatus: PartnerStatus?
    var errorMessage: String?

    private var token: String?
    private var saveTask: Task<Void, Never>?
    private var api: APIClient { APIClient(token: token) }

    private static let tokenKey = "splitmate-token"
    private static let guestKey = "splitmate-guest"

    // MARK: Names

    var p1Name: String { user?.p1Name.flatMap { $0.isEmpty ? nil : $0 } ?? guestNames.p1 }
    var p2Name: String { user?.p2Name.flatMap { $0.isEmpty ? nil : $0 } ?? guestNames.p2 }
    func name(_ payer: Payer) -> String { payer == .me ? p1Name : p2Name }

    private var guestNames: (p1: String, p2: String) {
        (UserDefaults.standard.string(forKey: "guest-p1") ?? "Partner 1",
         UserDefaults.standard.string(forKey: "guest-p2") ?? "Partner 2")
    }

    // MARK: Derived

    var unpaid: [Transaction] { transactions.filter { !$0.isSettled } }
    var paid: [Transaction] { transactions.filter(\.isSettled) }

    /// Unpaid shared spending by each partner.
    func paidTotal(_ payer: Payer) -> Double {
        unpaid.filter { !$0.isPersonal && $0.payer == payer }.reduce(0) { $0 + $1.amount }
    }

    /// Positive: partner 1 owes partner 2. Negative: partner 2 owes partner 1.
    var netBalance: Double {
        unpaid.filter { !$0.isPersonal }.reduce(0) { net, t in
            t.payer == .me ? net - t.partnerShare : net + t.partnerShare
        }
    }

    var balanceSummary: String {
        let net = netBalance
        if abs(net) < 0.01 { return "All settled up" }
        return net > 0 ? "\(p1Name) owes \(p2Name) \(Money.format(net))"
                       : "\(p2Name) owes \(p1Name) \(Money.format(-net))"
    }

    // MARK: Startup

    func start() async {
        if let saved = Keychain.get(Self.tokenKey) {
            token = saved
            do {
                user = try await api.me()
                session = .signedIn
                await refresh()
            } catch let e as APIError where e.isUnauthorized {
                signOutLocally()
            } catch {
                // Offline: stay signed in with whatever we can load later.
                session = .signedIn
            }
        } else if UserDefaults.standard.bool(forKey: Self.guestKey) {
            transactions = loadGuestTransactions()
            session = .guest
        } else {
            session = .signedOut
        }
    }

    func refresh() async {
        guard session == .signedIn else { return }
        do {
            async let txs = api.transactions()
            async let settings = api.paymentSettings()
            async let partner = api.partnerStatus()
            transactions = try await txs
            paymentSettings = (try? await settings) ?? paymentSettings
            partnerStatus = try? await partner
        } catch let e as APIError where e.isUnauthorized {
            signOutLocally()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: Auth

    func signIn(email: String, password: String) async throws {
        let (token, user) = try await api.login(email: email.trimmingCharacters(in: .whitespaces), password: password)
        await finishSignIn(token: token, user: user)
    }

    func register(email: String, password: String, p1: String, p2: String) async throws {
        let guestData = session == .guest ? transactions : []
        let (token, user) = try await api.register(email: email.trimmingCharacters(in: .whitespaces),
                                                   password: password, p1Name: p1, p2Name: p2)
        await finishSignIn(token: token, user: user)
        // Like the web app, carry guest expenses into the new account.
        if !guestData.isEmpty {
            transactions = guestData + transactions
            scheduleSave()
        }
    }

    private func finishSignIn(token: String, user: User) async {
        self.token = token
        self.user = user
        Keychain.set(token, for: Self.tokenKey)
        UserDefaults.standard.set(false, forKey: Self.guestKey)
        session = .signedIn
        await refresh()
    }

    func continueAsGuest() {
        UserDefaults.standard.set(true, forKey: Self.guestKey)
        transactions = loadGuestTransactions()
        session = .guest
    }

    func signOut() {
        signOutLocally()
    }

    private func signOutLocally() {
        saveTask?.cancel()
        token = nil
        user = nil
        transactions = []
        partnerStatus = nil
        paymentSettings = PaymentSettings()
        Keychain.set(nil, for: Self.tokenKey)
        UserDefaults.standard.set(false, forKey: Self.guestKey)
        session = .signedOut
    }

    // MARK: Transactions

    func add(_ t: Transaction) {
        transactions.insert(t, at: 0)
        scheduleSave()
    }

    func update(_ t: Transaction) {
        guard let i = transactions.firstIndex(where: { $0.id == t.id }) else { return }
        transactions[i] = t
        scheduleSave()
    }

    func settle(_ t: Transaction) {
        guard let i = transactions.firstIndex(where: { $0.id == t.id }) else { return }
        transactions[i].settle()
        scheduleSave()
    }

    func delete(_ t: Transaction) {
        transactions.removeAll { $0.id == t.id }
        scheduleSave()
    }

    func settleAll() {
        for i in transactions.indices where !transactions[i].isSettled && abs(transactions[i].youOwe) > 0.01 {
            transactions[i].settle()
        }
        scheduleSave()
    }

    /// Debounced, like the web app, so quick edits become one upload.
    private func scheduleSave() {
        saveTask?.cancel()
        let snapshot = transactions
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            switch session {
            case .signedIn:
                do { try await api.save(snapshot) }
                catch { errorMessage = "Couldn't sync: \(error.localizedDescription)" }
            case .guest:
                saveGuestTransactions(snapshot)
            default: break
            }
        }
    }

    // MARK: Settings

    func saveNames(p1: String, p2: String) async throws {
        if session == .signedIn {
            try await api.updateNames(p1: p1, p2: p2)
            user?.p1Name = p1
            user?.p2Name = p2
        } else {
            UserDefaults.standard.set(p1, forKey: "guest-p1")
            UserDefaults.standard.set(p2, forKey: "guest-p2")
        }
    }

    func savePaymentSettings() async throws {
        try await api.savePaymentSettings(paymentSettings)
    }

    func createInvite() async throws {
        let code = try await api.createInvite()
        partnerStatus = PartnerStatus(linked: false, partner: nil, inviteCode: code)
    }

    func acceptInvite(_ code: String) async throws {
        try await api.acceptInvite(code.uppercased().trimmingCharacters(in: .whitespaces))
        await refresh()
    }

    func unlinkPartner() async throws {
        try await api.unlinkPartner()
        await refresh()
    }

    func processReceipt(jpegBase64: String) async throws -> ReceiptData {
        try await api.processReceipt(jpegBase64: jpegBase64)
    }

    // MARK: Guest storage

    private var guestFile: URL {
        URL.applicationSupportDirectory.appending(path: "guest-transactions.json")
    }

    private func loadGuestTransactions() -> [Transaction] {
        guard let data = try? Data(contentsOf: guestFile),
              let raw = try? JSONDecoder().decode([[String: JSONValue]].self, from: data) else { return [] }
        return raw.map(Transaction.init(raw:))
    }

    private func saveGuestTransactions(_ txs: [Transaction]) {
        try? FileManager.default.createDirectory(at: .applicationSupportDirectory, withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(txs.map(\.raw)) {
            try? data.write(to: guestFile, options: .atomic)
        }
    }
}
