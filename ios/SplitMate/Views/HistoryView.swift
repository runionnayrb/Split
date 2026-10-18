import SwiftUI

struct HistoryView: View {
    enum Filter: String, CaseIterable { case unpaid = "Unpaid", paid = "Paid" }

    @Environment(AppStore.self) private var store
    @State private var filter: Filter = .unpaid
    @State private var search = ""
    @State private var month: String?  // "yyyy-MM"
    @State private var selected: Transaction?
    @State private var confirmPayAll = false

    private static let monthKey: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM"; return f
    }()

    private var source: [Transaction] { filter == .unpaid ? store.unpaid : store.paid }

    private var filtered: [Transaction] {
        source.filter { t in
            (month == nil || Self.monthKey.string(from: t.date) == month)
                && (search.isEmpty || t.title.localizedCaseInsensitiveContains(search)
                    || (t.friendSplit?.name.localizedCaseInsensitiveContains(search) ?? false))
        }
        .sorted { $0.date > $1.date }
    }

    private var sections: [(title: String, items: [Transaction])] {
        let cal = Calendar.current
        let groups = Dictionary(grouping: filtered) { cal.dateInterval(of: .month, for: $0.date)?.start ?? $0.date }
        return groups.keys.sorted(by: >).map { start in
            let sameYear = cal.isDate(start, equalTo: .now, toGranularity: .year)
            let title = cal.isDate(start, equalTo: .now, toGranularity: .month) ? "This Month"
                : start.formatted(sameYear ? .dateTime.month(.wide) : .dateTime.month(.wide).year())
            return (title, groups[start]!)
        }
    }

    private var months: [String] {
        Array(Set(store.transactions.map { Self.monthKey.string(from: $0.date) })).sorted(by: >)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Show", selection: $filter.animation()) {
                        ForEach(Filter.allCases, id: \.self) { f in
                            Text(f == .unpaid ? "Unpaid (\(store.unpaid.count))" : f.rawValue).tag(f)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }

                ForEach(sections, id: \.title) { section in
                    Section(section.title) {
                        ForEach(section.items) { t in
                            Button { selected = t } label: { TransactionRow(transaction: t) }
                                .buttonStyle(.plain)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) { withAnimation { store.delete(t) } } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .swipeActions(edge: .leading) {
                                    if !t.isSettled {
                                        Button { withAnimation { store.settle(t) } } label: {
                                            Label("Settle", systemImage: "checkmark.circle")
                                        }
                                        .tint(Theme.mint)
                                    }
                                }
                        }
                    }
                }
            }
            .appListStyle()
            .overlay {
                if filtered.isEmpty {
                    ContentUnavailableView {
                        Label(search.isEmpty ? (filter == .unpaid ? "All settled up" : "Nothing paid yet") : "No results",
                              systemImage: search.isEmpty ? (filter == .unpaid ? "checkmark.seal" : "tray") : "magnifyingglass")
                    } description: {
                        Text(search.isEmpty ? (filter == .unpaid ? "Expenses you add will show up here." : "Settled expenses will show up here.")
                                            : "Try a different search.")
                    }
                }
            }
            .navigationTitle("History")
            .searchable(text: $search, prompt: "Search expenses")
            .refreshable { await store.refresh() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Month", selection: $month) {
                            Text("All time").tag(String?.none)
                            ForEach(months, id: \.self) { key in
                                Text(Self.monthKey.date(from: key)?.formatted(.dateTime.month(.wide).year()) ?? key)
                                    .tag(Optional(key))
                            }
                        }
                    } label: {
                        Label("Filter", systemImage: month == nil ? "line.3.horizontal.decrease" : "line.3.horizontal.decrease.circle.fill")
                    }
                }
                if !store.unpaid.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Settle All", systemImage: "checkmark.circle") { confirmPayAll = true }
                    }
                }
            }
            .confirmationDialog("Settle all \(store.unpaid.count) unpaid expenses?", isPresented: $confirmPayAll,
                                titleVisibility: .visible) {
                Button("Settle All") { withAnimation { store.settleAll() } }
            } message: {
                Text("They'll move to Paid. \(store.balanceSummary).")
            }
            .sheet(item: $selected) { t in
                TransactionDetailView(transactionID: t.id)
            }
        }
    }
}

struct TransactionRow: View {
    @Environment(AppStore.self) private var store
    let transaction: Transaction

    var body: some View {
        let t = transaction
        HStack(spacing: 12) {
            CategoryIcon(category: t.category)
            VStack(alignment: .leading, spacing: 3) {
                Text(t.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text("\(t.date.formatted(date: .abbreviated, time: .omitted)) · \(store.name(t.payer)) paid")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let fs = t.friendSplit {
                    Label("\(fs.name) owes \(Money.format(fs.amount))", systemImage: "person.fill")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(t.isSettled ? Color.secondary : Theme.mint)
                } else if !t.isSettled {
                    Text("\(store.name(t.payer.other)) owes \(Money.format(t.partnerShare))")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.coral)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Text(Money.format(t.amount))
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.primary)
                if t.isSettled {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.mint).font(.caption)
                } else if t.isFromReceipt {
                    Image(systemName: "doc.text.image").foregroundStyle(.secondary).font(.caption)
                }
            }
        }
        .padding(.vertical, 4)
        .contentShape(.rect)
    }
}
