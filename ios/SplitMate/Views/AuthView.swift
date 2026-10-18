import SwiftUI

struct AuthView: View {
    enum Mode: String, CaseIterable { case signIn = "Sign In", create = "Create Account" }

    @Environment(AppStore.self) private var store
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var p1 = ""
    @State private var p2 = ""
    @State private var isWorking = false
    @State private var error: String?
    @FocusState private var focus: Field?

    enum Field { case email, password, p1, p2 }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(spacing: 28) {
                    header
                    form
                    Button("Continue without an account") { store.continueAsGuest() }
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 24)
                .padding(.top, 80)
                .padding(.bottom, 40)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var header: some View {
        VStack(spacing: 12) {
            Image("Logo")
                .resizable()
                .frame(width: 84, height: 84)
                .clipShape(.rect(cornerRadius: 20))
                .shadow(color: Theme.indigo.opacity(0.5), radius: 24)
            Text("SplitMate")
                .font(.system(size: 38, weight: .bold, design: .rounded))
                .foregroundStyle(Theme.brandGradient)
            Text("Your expenses. Your account.\nAlways in sync.")
                .font(.callout)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
    }

    private var form: some View {
        VStack(spacing: 14) {
            Picker("Mode", selection: $mode.animation()) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .padding(.bottom, 6)

            field("Email", text: $email, icon: "envelope")
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focus, equals: .email)
                .submitLabel(.next)
                .onSubmit { focus = .password }

            HStack(spacing: 12) {
                Image(systemName: "lock").foregroundStyle(.secondary).frame(width: 20)
                SecureField("Password", text: $password)
                    .textContentType(mode == .create ? .newPassword : .password)
                    .focused($focus, equals: .password)
                    .submitLabel(mode == .create ? .next : .go)
                    .onSubmit { mode == .create ? (focus = .p1) : submit() }
            }
            .fieldBackground()

            if mode == .create {
                field("Your name", text: $p1, icon: "person")
                    .textContentType(.givenName)
                    .focused($focus, equals: .p1)
                    .submitLabel(.next)
                    .onSubmit { focus = .p2 }
                field("Partner's name", text: $p2, icon: "person.2")
                    .focused($focus, equals: .p2)
                    .submitLabel(.go)
                    .onSubmit(submit)
            }

            if let error {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .font(.footnote)
                    .foregroundStyle(Theme.coral)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: submit) {
                Group {
                    if isWorking { ProgressView() } else { Text(mode.rawValue).fontWeight(.semibold) }
                }
                .frame(maxWidth: .infinity, minHeight: 32)
            }
            .buttonStyle(.glassProminent).tint(Theme.indigo)
            .controlSize(.large)
            .disabled(isWorking || email.isEmpty || password.isEmpty)
            .padding(.top, 6)
        }
        .padding(20)
        .glassEffect(.regular, in: .rect(cornerRadius: 28))
    }

    private func field(_ title: String, text: Binding<String>, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(.secondary).frame(width: 20)
            TextField(title, text: text)
        }
        .fieldBackground()
    }

    private func submit() {
        guard !email.isEmpty, !password.isEmpty else { return }
        error = nil
        isWorking = true
        focus = nil
        Task {
            defer { isWorking = false }
            do {
                if mode == .signIn {
                    try await store.signIn(email: email, password: password)
                } else {
                    try await store.register(email: email, password: password,
                                             p1: p1.isEmpty ? "Partner 1" : p1, p2: p2.isEmpty ? "Partner 2" : p2)
                }
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

extension View {
    func fieldBackground() -> some View {
        padding(.horizontal, 16)
            .frame(minHeight: 50)
            .background(.white.opacity(0.06), in: .rect(cornerRadius: 14))
    }
}
