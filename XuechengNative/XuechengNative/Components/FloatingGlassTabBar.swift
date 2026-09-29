import SwiftUI

enum AppTab: String, CaseIterable, Identifiable, Hashable {
    case today
    case path
    case companion
    case me

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: "今天"
        case .path: "路径"
        case .companion: "小程"
        case .me: "我的"
        }
    }

    var symbol: String {
        switch self {
        case .today: "house"
        case .path: "map"
        case .companion: "sparkle"
        case .me: "person"
        }
    }
}

struct FloatingGlassTabBar: View {
    @Environment(\.colorScheme) private var scheme
    @Binding var selection: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { selection = tab }
                } label: {
                    VStack(spacing: XuechengTheme.navigationIconLabelGap) {
                        Image(systemName: tab.symbol)
                            .font(.system(size: XuechengTheme.navigationIconSize, weight: .regular, design: .default))
                            .frame(height: 22)
                        Text(tab.title)
                            .font(XuechengTypography.metadata.font)
                            .tracking(XuechengTypography.metadata.letterSpacing)
                            .lineLimit(1)
                    }
                    .foregroundStyle(selection == tab ? XuechengTheme.primaryText(scheme) : XuechengTheme.navigationInactive(scheme))
                    .frame(maxWidth: .infinity)
                    .frame(height: XuechengTheme.navigationItemHeight)
                    .background {
                        if selection == tab {
                            RoundedRectangle(cornerRadius: XuechengTheme.navigationItemRadius, style: .continuous)
                                .fill(XuechengTheme.navigationActive(scheme))
                                .overlay {
                                    RoundedRectangle(cornerRadius: XuechengTheme.navigationItemRadius, style: .continuous)
                                        .strokeBorder(XuechengTheme.glassEdge(scheme), lineWidth: 0.7)
                                }
                        }
                    }
                    .padding(.horizontal, 5)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(selection == tab ? .isSelected : [])
            }
        }
        .padding(.horizontal, XuechengTheme.space8)
        .frame(height: XuechengTheme.navigationHeight)
        .background {
            RoundedRectangle(cornerRadius: XuechengTheme.navigationRadius, style: .continuous)
                .fill(XuechengTheme.Materials.floating)
                .overlay {
                    RoundedRectangle(cornerRadius: XuechengTheme.navigationRadius, style: .continuous)
                        .fill(XuechengTheme.navigationBackground(scheme))
                }
        }
        .overlay {
            RoundedRectangle(cornerRadius: XuechengTheme.navigationRadius, style: .continuous)
                .strokeBorder(XuechengTheme.glassEdge(scheme), lineWidth: 0.7)
        }
        .shadow(color: XuechengTheme.shadow(.small, scheme: scheme).color, radius: 19, x: 0, y: 14)
        .sensoryFeedback(.selection, trigger: selection)
    }
}

#Preview("Navigation · Light") {
    FloatingGlassTabBar(selection: .constant(.today))
        .padding(24)
        .background(AmbientBackground(mode: .light))
    .environment(\.colorScheme, .light)
}

#Preview("Navigation · Dark") {
    FloatingGlassTabBar(selection: .constant(.companion))
        .padding(24)
        .background(AmbientBackground(mode: .dark))
        .environment(\.colorScheme, .dark)
}
