import SwiftUI

enum Theme {
    static let background = Color(red: 7 / 255, green: 7 / 255, blue: 26 / 255)   // #07071a
    static let sky = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)       // #38bdf8
    static let indigo = Color(red: 99 / 255, green: 102 / 255, blue: 241 / 255)    // #6366f1
    static let mint = Color(red: 52 / 255, green: 211 / 255, blue: 153 / 255)      // #34d399
    static let coral = Color(red: 251 / 255, green: 113 / 255, blue: 133 / 255)    // #fb7185

    static let brandGradient = LinearGradient(colors: [sky, indigo], startPoint: .topLeading, endPoint: .bottomTrailing)
}

/// Navy backdrop with a soft glow, so glass surfaces have something to refract.
struct AppBackground: View {
    var body: some View {
        ZStack {
            Theme.background
            RadialGradient(colors: [Theme.indigo.opacity(0.28), .clear], center: .topLeading, startRadius: 0, endRadius: 420)
            RadialGradient(colors: [Theme.sky.opacity(0.16), .clear], center: .bottomTrailing, startRadius: 0, endRadius: 480)
        }
        .ignoresSafeArea()
    }
}

extension View {
    /// Standard list/form styling over the app background.
    func appListStyle() -> some View {
        scrollContentBackground(.hidden)
            .background(AppBackground())
    }
}

enum Money {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.locale = Locale(identifier: "en_US")
        return f
    }()

    static func format(_ value: Double) -> String {
        formatter.string(from: NSNumber(value: value)) ?? String(format: "$%.2f", value)
    }

    static func round(_ value: Double) -> Double { (value * 100).rounded() / 100 }
}

enum Category: String, CaseIterable, Identifiable {
    case groceries, dining, travel, shopping, other
    var id: String { rawValue }

    init(raw: String?) { self = Category(rawValue: raw ?? "") ?? .other }

    var title: String { rawValue.capitalized }

    var symbol: String {
        switch self {
        case .groceries: "cart.fill"
        case .dining: "fork.knife"
        case .travel: "airplane"
        case .shopping: "bag.fill"
        case .other: "square.grid.2x2.fill"
        }
    }

    var color: Color {
        switch self {
        case .groceries: Theme.mint
        case .dining: .orange
        case .travel: Theme.sky
        case .shopping: .pink
        case .other: Theme.indigo
        }
    }
}

struct CategoryIcon: View {
    let category: Category
    var size: CGFloat = 40

    var body: some View {
        Image(systemName: category.symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(category.color)
            .frame(width: size, height: size)
            .background(category.color.opacity(0.16), in: .rect(cornerRadius: size * 0.3))
    }
}
