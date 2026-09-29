import SwiftUI

struct PathView: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: XuechengTheme.space24) {
                    VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                        Text("你的方向")
                            .font(XuechengTypography.metadata.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        Text(PreviewFixtures.direction.title)
                            .font(XuechengTypography.pageTitle.font)
                            .lineSpacing(XuechengTypography.pageTitle.lineSpacing)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                    }
                    .padding(.top, 38)

                    Text("能力路径")
                        .font(XuechengTypography.sectionTitle.font)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))

                    Text("每一步来自目标与练习表现。点开能力，可以查看依据和下一项验证。")
                        .font(XuechengTypography.secondaryBody.font)
                        .lineSpacing(XuechengTypography.secondaryBody.lineSpacing)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))

                    LazyVStack(spacing: XuechengTheme.space12) {
                        ForEach(PreviewFixtures.capabilities) { capability in
                            NavigationLink(value: PathDestination.capability(capability.id)) {
                                CapabilityCard(capability: capability)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.bottom, XuechengTheme.space32)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .top, spacing: 0) { NativeHeader(title: "路径") }
        .toolbar(.hidden, for: .navigationBar)
    }
}

#Preview("路径 · 浅色") {
    NavigationStack { PathView() }
        .preferredColorScheme(.light)
}

#Preview("路径 · 深色") {
    NavigationStack { PathView() }
        .preferredColorScheme(.dark)
}
