import SwiftUI

/// A shareable image of an expense, like the web app's "Share" receipt card.
struct ShareCard: View {
    let transaction: Transaction
    let p1: String
    let p2: String
    let owedLine: String
    let payLines: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Text("SplitMate")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(Theme.brandGradient)
                Spacer()
                Text(transaction.date.formatted(date: .abbreviated, time: .omitted))
                    .foregroundStyle(.white.opacity(0.5))
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(transaction.title)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                Text(Money.format(transaction.amount))
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("Paid by \(transaction.payer == .me ? p1 : p2)")
                    .foregroundStyle(.white.opacity(0.6))
            }
            VStack(spacing: 10) {
                Text(owedLine)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Theme.mint)
                if !payLines.isEmpty {
                    Text("Send payment via").font(.caption).foregroundStyle(.white.opacity(0.4))
                    ForEach(payLines, id: \.self) { Text($0).foregroundStyle(.white.opacity(0.75)) }
                }
            }
            .frame(maxWidth: .infinity)
            .padding(20)
            .background(Theme.mint.opacity(0.10), in: .rect(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(Theme.mint.opacity(0.3)))
            Text("Generated with SplitMate · Expense Splitter for Couples")
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.25))
                .frame(maxWidth: .infinity)
        }
        .padding(32)
        .frame(width: 420)
        .background(AppBackground())
    }

    @MainActor
    static func image(for t: Transaction, store: AppStore) -> Image {
        let s = store.paymentSettings
        var lines: [String] = []
        if s.cashapp.enabled, !s.cashTag.isEmpty { lines.append("Cash App: $\(s.cashTag)") }
        if s.venmo.enabled, !s.venmo.username.isEmpty { lines.append("Venmo: @\(s.venmo.username)") }
        if let z = s.zelleDisplay { lines.append("Zelle: \(z)") }
        let card = ShareCard(transaction: t, p1: store.p1Name, p2: store.p2Name,
                             owedLine: owedLine(t, store: store), payLines: lines)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        return renderer.uiImage.map(Image.init(uiImage:)) ?? Image(systemName: "doc")
    }

    @MainActor
    static func message(for t: Transaction, store: AppStore) -> String {
        if let fs = t.friendSplit {
            return "Hey \(fs.name)! You owe me \(Money.format(fs.amount)) for \(t.title). Here's the receipt breakdown!"
        }
        return "Expense: \(t.title) · \(Money.format(t.amount))"
    }

    @MainActor
    private static func owedLine(_ t: Transaction, store: AppStore) -> String {
        if let fs = t.friendSplit { return "Send \(Money.format(fs.amount)) to settle up" }
        return "\(store.name(t.payer.other)) owes \(Money.format(t.partnerShare))"
    }
}
