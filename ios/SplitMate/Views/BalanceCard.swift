import SwiftUI

/// Liquid Glass summary of who has paid what and who owes whom.
struct BalanceCard: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        let net = store.netBalance
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                total(store.p1Name, store.paidTotal(.me))
                total(store.p2Name, store.paidTotal(.spouse))
            }

            HStack(spacing: 8) {
                Image(systemName: abs(net) < 0.01 ? "checkmark.seal.fill" : "arrow.left.arrow.right.circle.fill")
                Text(store.balanceSummary)
                    .contentTransition(.numericText())
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(abs(net) < 0.01 ? Theme.mint : .white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .glassEffect(.regular.tint((abs(net) < 0.01 ? Theme.mint : Theme.indigo).opacity(0.25)), in: .capsule)
        }
        .padding(16)
        .glassEffect(.regular.tint(Theme.indigo.opacity(0.12)), in: .rect(cornerRadius: 28))
        .animation(.snappy, value: net)
    }

    private func total(_ name: String, _ amount: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(name) paid")
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(Money.format(amount))
                .font(.title2.weight(.bold).monospacedDigit())
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.white.opacity(0.05), in: .rect(cornerRadius: 18))
    }
}
