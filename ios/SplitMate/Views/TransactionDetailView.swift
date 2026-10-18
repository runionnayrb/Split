import SwiftUI

struct TransactionDetailView: View {
    let transactionID: String

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var showReceipt = false
    @State private var copiedZelle = false

    private var transaction: Transaction? { store.transactions.first { $0.id == transactionID } }

    var body: some View {
        NavigationStack {
            if let t = transaction {
                content(t)
            } else {
                ContentUnavailableView("Expense removed", systemImage: "trash")
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    /// Amount still owed on this expense, and by whom.
    private func owed(_ t: Transaction) -> (who: String, amount: Double)? {
        guard !t.isSettled else { return nil }
        if let fs = t.friendSplit { return (fs.name, fs.amount) }
        return (store.name(t.payer.other), t.partnerShare)
    }

    private func content(_ t: Transaction) -> some View {
        List {
            Section {
                VStack(spacing: 10) {
                    CategoryIcon(category: t.category, size: 56)
                    Text(Money.format(t.amount))
                        .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
                    Text(t.title)
                        .font(.headline)
                        .multilineTextAlignment(.center)
                    if t.isSettled {
                        Label("Settled \(t.settledDate?.formatted(date: .abbreviated, time: .omitted) ?? "")",
                              systemImage: "checkmark.seal.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.mint)
                    } else if let owed = owed(t) {
                        Text("\(owed.who) owes \(Money.format(owed.amount))")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .glassEffect(.regular.tint(Theme.coral.opacity(0.25)), in: .capsule)
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
            }

            Section {
                LabeledContent("Paid by", value: store.name(t.payer))
                LabeledContent("Category", value: t.category.title)
                LabeledContent("Date", value: t.date.formatted(date: .long, time: .omitted))
                if let fs = t.friendSplit {
                    LabeledContent("Friend", value: fs.name)
                    LabeledContent("Their share", value: Money.format(fs.amount))
                }
                if t.receiptImageData != nil {
                    Button { showReceipt = true } label: {
                        Label("View Receipt", systemImage: "doc.text.image")
                    }
                }
            }

            if let owed = owed(t), store.paymentSettings.hasAny {
                Section {
                    payButtons(amount: owed.amount, note: t.title)
                } header: {
                    Text("Get paid")
                } footer: {
                    Text("Opens the app with \(Money.format(owed.amount)) filled in.")
                }
            }

            Section {
                if !t.isSettled {
                    Button {
                        withAnimation { store.settle(t) }
                        dismiss()
                    } label: {
                        Label("Mark as Settled", systemImage: "checkmark.circle.fill")
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 30)
                    }
                    .buttonStyle(.glassProminent).tint(Theme.indigo)
                    .controlSize(.large)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
        }
        .appListStyle()
        .navigationTitle(t.isSettled ? "Paid" : "Unpaid")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(role: .close) { dismiss() }
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                ShareLink(item: ShareCard.image(for: t, store: store),
                          message: Text(ShareCard.message(for: t, store: store)),
                          preview: SharePreview(t.title, image: ShareCard.image(for: t, store: store))) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
                Menu {
                    Button("Edit", systemImage: "pencil") { editing = true }
                    Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
                } label: {
                    Label("More", systemImage: "ellipsis")
                }
            }
        }
        .confirmationDialog("Delete this expense?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                dismiss()
                withAnimation { store.delete(t) }
            }
        } message: {
            Text("This can't be undone.")
        }
        .sheet(isPresented: $editing) {
            EditTransactionView(transaction: t)
        }
        .fullScreenCover(isPresented: $showReceipt) {
            ReceiptViewer(data: t.receiptImageData)
        }
    }

    @ViewBuilder
    private func payButtons(amount: Double, note: String) -> some View {
        let s = store.paymentSettings
        if let url = s.cashAppURL(amount: amount) {
            Button { openURL(url) } label: {
                payLabel("Cash App", letter: "$", color: Theme.mint, amount: amount)
            }
        }
        if let url = s.venmoURL(amount: amount, note: note) {
            Button { openURL(url) } label: {
                payLabel("Venmo", letter: "V", color: Theme.sky, amount: amount)
            }
        }
        if let phone = s.zelleDisplay {
            Button {
                UIPasteboard.general.string = s.zelle.phone.filter(\.isNumber)
                copiedZelle = true
            } label: {
                HStack {
                    payLabel("Zelle", letter: "Z", color: .purple, amount: nil)
                    Spacer()
                    Text(copiedZelle ? "Copied" : phone).foregroundStyle(.secondary)
                    Image(systemName: copiedZelle ? "checkmark" : "doc.on.doc").foregroundStyle(.secondary)
                }
            }
            .sensoryFeedback(.success, trigger: copiedZelle) { _, new in new }
        }
    }

    private func payLabel(_ title: String, letter: String, color: Color, amount: Double?) -> some View {
        HStack(spacing: 12) {
            Text(letter)
                .font(.headline)
                .foregroundStyle(color)
                .frame(width: 32, height: 32)
                .background(color.opacity(0.16), in: .rect(cornerRadius: 9))
            Text(title).foregroundStyle(.primary)
            if let amount {
                Spacer()
                Text(Money.format(amount)).monospacedDigit().foregroundStyle(.secondary)
                Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

struct ReceiptViewer: View {
    let data: Data?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                if let data, let image = UIImage(data: data) {
                    ScrollView([.horizontal, .vertical]) {
                        Image(uiImage: image).resizable().scaledToFit()
                            .containerRelativeFrame(.horizontal)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(role: .close) { dismiss() }
                }
            }
        }
    }
}

struct EditTransactionView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Transaction
    @State private var notes: String
    @State private var amountText: String
    @State private var category: Category
    @State private var payer: Payer
    @State private var date: Date

    init(transaction: Transaction) {
        _draft = State(initialValue: transaction)
        _notes = State(initialValue: transaction.notes)
        _amountText = State(initialValue: String(format: "%.2f", transaction.amount))
        _category = State(initialValue: transaction.category)
        _payer = State(initialValue: transaction.payer)
        _date = State(initialValue: transaction.date)
    }

    private var amount: Double? { Double(amountText).flatMap { $0 > 0 ? $0 : nil } }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Description", text: $notes)
                    HStack {
                        Text("$").foregroundStyle(.secondary)
                        TextField("0.00", text: $amountText).keyboardType(.decimalPad)
                    }
                    Picker("Paid by", selection: $payer) {
                        Text(store.p1Name).tag(Payer.me)
                        Text(store.p2Name).tag(Payer.spouse)
                    }
                    Picker("Category", selection: $category) {
                        ForEach(Category.allCases) { c in Label(c.title, systemImage: c.symbol).tag(c) }
                    }
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                } footer: {
                    if draft.isFromReceipt {
                        Text("Changing the amount of a scanned receipt switches it to a simple 50/50 split.")
                    }
                }
            }
            .appListStyle()
            .navigationTitle("Edit Expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", systemImage: "checkmark", role: .confirm) {
                        guard let amount else { return }
                        var cal = Calendar.current
                        cal.timeZone = .current
                        let noon = cal.date(bySettingHour: 12, minute: 0, second: 0, of: date) ?? date
                        draft.applyEdit(notes: notes, amount: amount, category: category, payer: payer, date: noon)
                        store.update(draft)
                        dismiss()
                    }
                    .disabled(amount == nil)
                }
            }
        }
    }
}
