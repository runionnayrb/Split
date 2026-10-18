import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import VisionKit

struct SplitView: View {
    @Environment(AppStore.self) private var store

    @State private var amountText = ""
    @State private var notes = ""
    @State private var category: Category = .other
    @State private var payer: Payer = .me
    @State private var friend = FriendSplitInput()
    @State private var added = false

    // Receipt scanning
    @State private var showScanner = false
    @State private var showFiles = false
    @State private var photoItem: PhotosPickerItem?
    @State private var scan: ReceiptScan?
    @State private var isProcessing = false

    @FocusState private var amountFocused: Bool

    private var amount: Double? {
        Double(amountText.replacingOccurrences(of: ",", with: ".")).flatMap { $0 > 0 ? $0 : nil }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    BalanceCard()
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section("Scan a receipt") {
                    scanButtons
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section("New expense") {
                    HStack {
                        Text("$").font(.title2.weight(.semibold)).foregroundStyle(.secondary)
                        TextField("0.00", text: $amountText)
                            .font(.title2.weight(.semibold).monospacedDigit())
                            .keyboardType(.decimalPad)
                            .focused($amountFocused)
                    }
                    TextField("What was it for?", text: $notes)
                    Picker("Paid by", selection: $payer) {
                        Text(store.p1Name).tag(Payer.me)
                        Text(store.p2Name).tag(Payer.spouse)
                    }
                    Picker("Category", selection: $category) {
                        ForEach(Category.allCases) { c in
                            Label(c.title, systemImage: c.symbol).tag(c)
                        }
                    }
                }

                FriendSplitSection(input: $friend, total: amount ?? 0)

                Section {
                    Button(action: addExpense) {
                        Label(added ? "Added" : "Add Expense", systemImage: added ? "checkmark" : "plus")
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 30)
                    }
                    .buttonStyle(.glassProminent).tint(Theme.indigo)
                    .controlSize(.large)
                    .disabled(amount == nil)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .sensoryFeedback(.success, trigger: added) { _, new in new }
                } footer: {
                    if amount != nil, !friend.isOn {
                        Text("\(store.name(payer.other)) will owe \(Money.format((amount ?? 0) / 2)).")
                    }
                }
            }
            .appListStyle()
            .navigationTitle("SplitMate")
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { amountFocused = false; hideKeyboard() }
                }
            }
            .overlay {
                if isProcessing { ProcessingOverlay() }
            }
            .fullScreenCover(isPresented: $showScanner) {
                DocumentScanner { image in
                    showScanner = false
                    if let image { process(image) }
                }
                .ignoresSafeArea()
            }
            .fileImporter(isPresented: $showFiles, allowedContentTypes: [.pdf, .image]) { result in
                guard case .success(let url) = result else { return }
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                if let image = ReceiptImage.load(from: url) { process(image) }
            }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                        process(image)
                    }
                    photoItem = nil
                }
            }
            .sheet(item: $scan) { scan in
                ReceiptReviewView(scan: scan)
            }
        }
    }

    private var scanButtons: some View {
        GlassEffectContainer(spacing: 10) {
            HStack(spacing: 10) {
                if VNDocumentCameraViewController.isSupported {
                    Button { showScanner = true } label: {
                        Label("Camera", systemImage: "doc.viewfinder").frame(maxWidth: .infinity, minHeight: 28)
                    }
                    .buttonStyle(.glassProminent).tint(Theme.indigo)
                }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Photos", systemImage: "photo").frame(maxWidth: .infinity, minHeight: 28)
                }
                .buttonStyle(.glass)
                Button { showFiles = true } label: {
                    Label("Files", systemImage: "folder").frame(maxWidth: .infinity, minHeight: 28)
                }
                .buttonStyle(.glass)
            }
            .labelStyle(.titleAndIcon)
            .font(.subheadline.weight(.semibold))
        }
    }

    private func addExpense() {
        guard let amount else { return }
        let t = Transaction.manual(amount: amount, notes: notes.trimmingCharacters(in: .whitespaces),
                                   category: category, payer: payer, friend: friend.split(total: amount))
        withAnimation { store.add(t) }
        amountText = ""
        notes = ""
        category = .other
        friend = FriendSplitInput()
        amountFocused = false
        added = true
        Task {
            try? await Task.sleep(for: .seconds(1.5))
            added = false
        }
    }

    private func process(_ image: UIImage) {
        guard let jpeg = ReceiptImage.compressed(image) else { return }
        isProcessing = true
        Task {
            defer { isProcessing = false }
            do {
                let data = try await store.processReceipt(jpegBase64: jpeg.base64EncodedString())
                if data.items.isEmpty {
                    store.errorMessage = "No items were found on that receipt. Try a clearer photo."
                } else {
                    scan = ReceiptScan(data: data, jpeg: jpeg)
                }
            } catch {
                store.errorMessage = "Couldn't read the receipt: \(error.localizedDescription)"
            }
        }
    }
}

struct ProcessingOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView().controlSize(.large)
                Text("Reading receipt…").font(.headline)
                Text("This can take a few seconds.").font(.caption).foregroundStyle(.secondary)
            }
            .padding(28)
            .glassEffect(.regular, in: .rect(cornerRadius: 24))
        }
        .transition(.opacity)
    }
}

// MARK: Friend split

struct FriendSplitInput: Equatable {
    var isOn = false
    var name = ""
    var isPercent = false
    var value = ""

    func split(total: Double) -> FriendSplit? {
        guard isOn else { return nil }
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty, let input = Double(value), input > 0 else { return nil }
        let amount = isPercent ? input / 100 * total : input
        guard amount > 0 else { return nil }
        return FriendSplit(name: n, amount: Money.round(amount), shareType: isPercent ? "percent" : "amount", shareInput: input)
    }
}

struct FriendSplitSection: View {
    @Binding var input: FriendSplitInput
    let total: Double

    var body: some View {
        Section {
            Toggle(isOn: $input.isOn.animation()) {
                Label("Split with a friend", systemImage: "person.badge.plus")
            }
            if input.isOn {
                TextField("Friend's name", text: $input.name)
                    .textContentType(.name)
                Picker("Their share", selection: $input.isPercent) {
                    Text("Amount").tag(false)
                    Text("Percent").tag(true)
                }
                .pickerStyle(.segmented)
                HStack {
                    Text(input.isPercent ? "%" : "$").foregroundStyle(.secondary)
                    TextField(input.isPercent ? "50" : "0.00", text: $input.value)
                        .keyboardType(.decimalPad)
                }
            }
        } footer: {
            if input.isOn {
                if let s = input.split(total: total) {
                    Text("\(s.name) owes you \(Money.format(s.amount)). Friend splits stay out of your shared balance.")
                } else {
                    Text("Friend splits stay out of your shared balance.")
                }
            }
        }
    }
}

@MainActor
func hideKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}
