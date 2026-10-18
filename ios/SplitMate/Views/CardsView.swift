import SwiftUI

/// The shared virtual card is "coming soon" on the web too; this explains it natively.
struct CardsView: View {
    private let features: [(icon: String, title: String, body: String)] = [
        ("creditcard.fill", "One shared virtual card",
         "A single card to use together for groceries, dining, subscriptions — anything. Add it to Apple Pay or shop online."),
        ("building.columns.fill", "Each partner links their real card",
         "You each connect your own debit or credit card. No shared bank account needed."),
        ("scalemass.fill", "Each person pays only their share",
         "Every charge is split automatically — 50/50 or any ratio you set — and billed to each partner's card."),
        ("bolt.fill", "No IOUs, no chasing people down",
         "Every purchase is settled the moment it happens. No more Zelle requests."),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    cardStack
                        .padding(.top, 8)
                    VStack(spacing: 10) {
                        Text("Coming Soon")
                            .font(.caption.weight(.bold))
                            .textCase(.uppercase)
                            .tracking(1.5)
                            .foregroundStyle(Theme.sky)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 6)
                            .glassEffect(.regular.tint(Theme.sky.opacity(0.2)), in: .capsule)
                        Text("One Card. Fair Charges.")
                            .font(.title.weight(.bold))
                            .foregroundStyle(Theme.brandGradient)
                        Text("Share one virtual card for purchases — each partner links their real card and only gets charged exactly what they owe.")
                            .font(.callout)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                    }
                    VStack(spacing: 12) {
                        ForEach(features, id: \.title) { f in
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: f.icon)
                                    .font(.title3)
                                    .foregroundStyle(Theme.brandGradient)
                                    .frame(width: 32)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(f.title).font(.headline)
                                    Text(f.body).font(.subheadline).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(16)
                            .glassEffect(.regular, in: .rect(cornerRadius: 20))
                        }
                    }
                    Text("In the meantime, scan receipts on the Split tab to log and split purchases automatically.")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .background(AppBackground())
            .navigationTitle("Cards")
        }
    }

    private var cardStack: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 22)
                .fill(LinearGradient(colors: [Theme.indigo, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 290, height: 180)
                .rotationEffect(.degrees(4))
                .offset(x: 14, y: 14)
            RoundedRectangle(cornerRadius: 22)
                .fill(LinearGradient(colors: [Theme.sky, Theme.sky.opacity(0.7), Theme.indigo.opacity(0.8)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 290, height: 180)
                .overlay(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 6).fill(.white.opacity(0.45))
                        .frame(width: 40, height: 30).padding(22)
                }
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("••••  ••••  ••••  1234").font(.headline.monospaced())
                        Text("SPLITMATE").font(.caption.weight(.bold)).tracking(2)
                    }
                    .foregroundStyle(.white)
                    .padding(22)
                }
                .rotationEffect(.degrees(-2))
                .shadow(color: Theme.sky.opacity(0.4), radius: 30, y: 10)
        }
        .frame(height: 220)
    }
}
