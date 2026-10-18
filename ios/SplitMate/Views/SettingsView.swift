import SwiftUI

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var p1 = ""
    @State private var p2 = ""
    @State private var confirmSignOut = false
    @State private var confirmPayAll = false

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            Form {
                Section {
                    TextField("Partner 1", text: $p1)
                    TextField("Partner 2", text: $p2)
                } header: {
                    Text("Partner names")
                } footer: {
                    if namesChanged {
                        Button("Save Names") { saveNames() }
                            .buttonStyle(.glassProminent).tint(Theme.indigo)
                            .padding(.top, 8)
                    }
                }

                if store.session == .signedIn {
                    Section {
                        NavigationLink {
                            PaymentMethodsView()
                        } label: {
                            LabeledContent {
                                Text(paymentSummary)
                            } label: {
                                Label("Payment Methods", systemImage: "dollarsign.circle")
                            }
                        }
                        NavigationLink {
                            PartnerAccessView()
                        } label: {
                            LabeledContent {
                                Text(store.partnerStatus?.linked == true ? "Linked" : "Not linked")
                            } label: {
                                Label("Partner Access", systemImage: "person.2")
                            }
                        }
                    } footer: {
                        Text("Payment methods let your partner pay you back in one tap.")
                    }
                }

                Section {
                    Button {
                        confirmPayAll = true
                    } label: {
                        Label("Settle All Outstanding", systemImage: "checkmark.circle")
                    }
                    .disabled(store.unpaid.isEmpty)
                } header: {
                    Text("Balance")
                } footer: {
                    Text("Marks every unpaid expense as settled and moves it to Paid.")
                }

                Section("Account") {
                    if let email = store.user?.email {
                        LabeledContent("Signed in as", value: email)
                        Button("Sign Out", role: .destructive) { confirmSignOut = true }
                    } else {
                        Text("You're using SplitMate without an account, so expenses stay on this iPhone.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Sign In or Create Account") { store.signOut() }
                    }
                }

                Section {
                    Link(destination: APIClient.baseURL.appending(path: "privacy.html")) {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }
                    Link(destination: APIClient.baseURL.appending(path: "terms.html")) {
                        Label("Terms of Service", systemImage: "doc.text")
                    }
                }
            }
            .appListStyle()
            .navigationTitle("Settings")
            .onAppear { p1 = store.p1Name; p2 = store.p2Name }
            .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { store.signOut() }
            } message: {
                Text("Your expenses stay saved in your account.")
            }
            .confirmationDialog("Settle all \(store.unpaid.count) unpaid expenses?", isPresented: $confirmPayAll,
                                titleVisibility: .visible) {
                Button("Settle All") { withAnimation { store.settleAll() } }
            } message: {
                Text(store.balanceSummary)
            }
        }
    }

    private var namesChanged: Bool {
        !p1.isEmpty && !p2.isEmpty && (p1 != store.p1Name || p2 != store.p2Name)
    }

    private var paymentSummary: String {
        let s = store.paymentSettings
        let names = [s.cashapp.enabled ? "Cash App" : nil, s.venmo.enabled ? "Venmo" : nil, s.zelle.enabled ? "Zelle" : nil]
            .compactMap { $0 }
        return names.isEmpty ? "None" : names.joined(separator: ", ")
    }

    private func saveNames() {
        hideKeyboard()
        Task {
            do { try await store.saveNames(p1: p1.trimmingCharacters(in: .whitespaces), p2: p2.trimmingCharacters(in: .whitespaces)) }
            catch { store.errorMessage = error.localizedDescription }
        }
    }
}

struct PaymentMethodsView: View {
    @Environment(AppStore.self) private var store
    @State private var saved = false
    @State private var isSaving = false

    var body: some View {
        @Bindable var store = store
        Form {
            Section {
                Toggle(isOn: $store.paymentSettings.cashapp.enabled.animation()) { methodLabel("Cash App", "$", Theme.mint) }
                if store.paymentSettings.cashapp.enabled {
                    TextField("$cashtag", text: $store.paymentSettings.cashapp.tag)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                }
            }
            Section {
                Toggle(isOn: $store.paymentSettings.venmo.enabled.animation()) { methodLabel("Venmo", "V", Theme.sky) }
                if store.paymentSettings.venmo.enabled {
                    TextField("Venmo username", text: $store.paymentSettings.venmo.username)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                }
            }
            Section {
                Toggle(isOn: $store.paymentSettings.zelle.enabled.animation()) { methodLabel("Zelle", "Z", .purple) }
                if store.paymentSettings.zelle.enabled {
                    TextField("Phone number", text: $store.paymentSettings.zelle.phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                }
            } footer: {
                if store.paymentSettings.zelle.enabled {
                    Text("Zelle has no payment link, so your partner copies this number and pays in their bank app.")
                }
            }
            Section {
            } footer: {
                Text("Apple Pay needs merchant registration, so it isn't available for paying each other back.")
            }
        }
        .appListStyle()
        .navigationTitle("Payment Methods")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saved ? "Saved" : "Save", systemImage: saved ? "checkmark" : "square.and.arrow.down") { save() }
                    .disabled(isSaving)
            }
        }
        .sensoryFeedback(.success, trigger: saved) { _, new in new }
    }

    private func methodLabel(_ title: String, _ letter: String, _ color: Color) -> some View {
        HStack(spacing: 12) {
            Text(letter).font(.headline).foregroundStyle(color)
                .frame(width: 32, height: 32)
                .background(color.opacity(0.16), in: .rect(cornerRadius: 9))
            Text(title)
        }
    }

    private func save() {
        hideKeyboard()
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await store.savePaymentSettings()
                saved = true
                try? await Task.sleep(for: .seconds(2))
                saved = false
            } catch {
                store.errorMessage = error.localizedDescription
            }
        }
    }
}

struct PartnerAccessView: View {
    @Environment(AppStore.self) private var store
    @State private var code = ""
    @State private var isWorking = false
    @State private var confirmUnlink = false

    var body: some View {
        Form {
            if let status = store.partnerStatus, status.linked {
                Section {
                    Label(status.partner?.email ?? "Partner", systemImage: "person.crop.circle.badge.checkmark")
                        .foregroundStyle(Theme.mint)
                } header: {
                    Text("Linked with")
                } footer: {
                    Text("You both see the same shared expenses and balance.")
                }
                Section {
                    Button("Unlink Partner", role: .destructive) { confirmUnlink = true }
                }
            } else {
                Section {
                    if let invite = store.partnerStatus?.inviteCode {
                        HStack {
                            Text(invite)
                                .font(.system(.title, design: .monospaced).weight(.bold))
                                .tracking(4)
                            Spacer()
                            ShareLink(item: "Join me on SplitMate! Enter this code in Settings → Partner Access: \(invite)") {
                                Image(systemName: "square.and.arrow.up")
                            }
                            .buttonStyle(.glass)
                        }
                    } else {
                        Button {
                            run { try await store.createInvite() }
                        } label: {
                            Label("Generate Invite Code", systemImage: "plus")
                        }
                    }
                } header: {
                    Text("Your invite code")
                } footer: {
                    Text("Codes expire after 24 hours.")
                }

                Section {
                    HStack {
                        TextField("Enter code", text: $code)
                            .font(.body.monospaced())
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        Button("Join") {
                            run { try await store.acceptInvite(code); code = "" }
                        }
                        .buttonStyle(.glassProminent).tint(Theme.indigo)
                        .disabled(code.count < 6 || isWorking)
                    }
                } header: {
                    Text("Have your partner's code?")
                }
            }
        }
        .appListStyle()
        .navigationTitle("Partner Access")
        .navigationBarTitleDisplayMode(.inline)
        .overlay { if isWorking { ProgressView() } }
        .refreshable { await store.refresh() }
        .confirmationDialog("Unlink your partner?", isPresented: $confirmUnlink, titleVisibility: .visible) {
            Button("Unlink", role: .destructive) { run { try await store.unlinkPartner() } }
        } message: {
            Text("You'll keep a personal copy of your shared expenses.")
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        isWorking = true
        Task {
            defer { isWorking = false }
            do { try await work() } catch { store.errorMessage = error.localizedDescription }
        }
    }
}
