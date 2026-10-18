import SwiftUI

struct ReceiptScan: Identifiable {
    let id = UUID()
    let data: ReceiptData
    let jpeg: Data
}

/// Review scanned items and decide who each one belongs to.
struct ReceiptReviewView: View {
    enum Assignment: Hashable { case payerOnly, split, otherOnly }

    let scan: ReceiptScan

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var payer: Payer = .me
    @State private var store_name = ""
    @State private var assignments: [UUID: Assignment] = [:]
    @State private var friend = FriendSplitInput()

    private var items: [ReceiptData.Item] { scan.data.items }
    private func assignment(_ item: ReceiptData.Item) -> Assignment { assignments[item.id] ?? .split }

    private func sum(_ a: Assignment) -> Double {
        items.filter { assignment($0) == a }.reduce(0) { $0 + $1.price }
    }

    private var itemsTotal: Double { items.reduce(0) { $0 + $1.price } }
    private var fees: Double { scan.data.feesTotal }
    private var total: Double { itemsTotal + fees }
    /// What the partner who didn't pay owes.
    private var otherOwes: Double { sum(.otherOnly) + sum(.split) / 2 + fees / 2 }
    private var payerCovers: Double { sum(.payerOnly) + sum(.split) / 2 + fees / 2 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Store or place", text: $store_name)
                    Picker("Paid by", selection: $payer) {
                        Text(store.p1Name).tag(Payer.me)
                        Text(store.p2Name).tag(Payer.spouse)
                    }
                }

                Section {
                    ForEach(items) { item in
                        itemRow(item)
                    }
                } header: {
                    Text("Items")
                } footer: {
                    Text("Tap an item to choose who it belongs to. Tax, tip and fees are always split 50/50.")
                }

                Section("Summary") {
                    LabeledContent("Items", value: Money.format(itemsTotal))
                    if fees > 0 { LabeledContent("Tax, tip & fees", value: Money.format(fees)) }
                    LabeledContent("Total", value: Money.format(total)).fontWeight(.semibold)
                    LabeledContent("\(store.name(payer)) covers", value: Money.format(payerCovers))
                    LabeledContent("\(store.name(payer.other)) owes", value: Money.format(otherOwes))
                        .foregroundStyle(Theme.mint)
                        .fontWeight(.semibold)
                }

                FriendSplitSection(input: $friend, total: total)

                if let image = UIImage(data: scan.jpeg) {
                    Section("Receipt") {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .clipShape(.rect(cornerRadius: 12))
                            .frame(maxHeight: 320)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .appListStyle()
            .navigationTitle("Review Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", systemImage: "checkmark", role: .confirm, action: add)
                }
            }
            .onAppear { store_name = scan.data.merchant ?? "" }
        }
    }

    private func itemRow(_ item: ReceiptData.Item) -> some View {
        Menu {
            Picker("Belongs to", selection: Binding(get: { assignment(item) }, set: { assignments[item.id] = $0 })) {
                Label("Split 50/50", systemImage: "circle.lefthalf.filled").tag(Assignment.split)
                Label("\(store.name(payer)) only", systemImage: "person.fill").tag(Assignment.payerOnly)
                Label("\(store.name(payer.other)) only", systemImage: "person").tag(Assignment.otherOnly)
            }
        } label: {
            HStack(spacing: 12) {
                CategoryIcon(category: Category(raw: item.category), size: 34)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name).foregroundStyle(.primary).lineLimit(2)
                    Text(label(for: assignment(item)))
                        .font(.caption)
                        .foregroundStyle(color(for: assignment(item)))
                }
                Spacer()
                Text(Money.format(item.price)).monospacedDigit().foregroundStyle(.primary)
            }
            .contentShape(.rect)
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
    }

    private func label(for a: Assignment) -> String {
        switch a {
        case .split: "Split 50/50"
        case .payerOnly: "\(store.name(payer)) only"
        case .otherOnly: "\(store.name(payer.other)) only"
        }
    }

    private func color(for a: Assignment) -> Color {
        switch a {
        case .split: Theme.sky
        case .payerOnly: .secondary
        case .otherOnly: Theme.mint
        }
    }

    private func add() {
        let net = otherOwes
        let payerTotal = payerCovers
        let bryanTotal = payer == .me ? payerTotal : net
        let ayakoTotal = payer == .me ? net : payerTotal
        let shared = items.filter { assignment($0) != .payerOnly }
        let category = Dictionary(grouping: shared.isEmpty ? items : shared) { Category(raw: $0.category) }
            .max { $0.value.count < $1.value.count }?.key ?? .groceries
        let friendSplit = friend.split(total: total)

        var t = Transaction(raw: [
            "id": .int(Int(Date().timeIntervalSince1970 * 1000)),
            "date": .string(ISODate.string(Date())),
            "whoPaid": .string(payer.rawValue),
            "amount": .number(Money.round(total)),
            "category": .string(category.rawValue),
            "notes": .string(notes()),
            "youOwe": .number(payer == .me ? net : -net),
            "receiptImage": .string("data:image/jpeg;base64," + scan.jpeg.base64EncodedString()),
            "isFromReceipt": .bool(true),
            "friendSplit": friendSplit?.json ?? .null,
            "scope": .string(friendSplit == nil ? "shared" : "personal"),
        ])
        t.raw["receiptBreakdown"] = .object([
            "grandTotal": .number(itemsTotal),
            "totalFees": .number(fees),
            "uncheckedTotal": .number(sum(.payerOnly)),
            "individualTotal": .number(sum(.otherOnly)),
            "splitTotal": .number(sum(.split)),
            "bryanFees": .number(fees / 2),
            "ayakoFees": .number(fees / 2),
            "bryanTotal": .number(bryanTotal),
            "ayakoTotal": .number(ayakoTotal),
            "ayakoOwes": .number(payer == .me ? net : -net),
        ])
        store.add(t)
        dismiss()
    }

    private func notes() -> String {
        let names = items.filter { assignment($0) != .payerOnly }.map(\.name)
        var s = store_name.trimmingCharacters(in: .whitespaces)
        if !s.isEmpty { s += " - " }
        s += names.prefix(2).joined(separator: ", ")
        if names.count > 2 { s += " + \(names.count - 2) more items" }
        if fees > 0 { s += " + \(Money.format(fees)) fees split 50/50" }
        return s
    }
}
