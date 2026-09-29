import SwiftUI

struct MeView: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(spacing: 10) {
                        Image(systemName: "person.fill")
                            .font(.title2.weight(.light))
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            .frame(width: 72, height: 72)
                            .background(
                                LinearGradient(
                                    colors: [XuechengTheme.mist(scheme), XuechengTheme.border(scheme)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                in: Circle()
                            )

                        Text("我与小程")
                            .font(XuechengTypography.pageTitle.font)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))

                        Text("一段持续了解、一起成长的关系。")
                            .font(XuechengTypography.caption.font)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 34)

                    FrostedSurface(radius: XuechengTheme.radius20) {
                        VStack(alignment: .leading, spacing: 13) {
                            Text("当前方向")
                                .font(XuechengTypography.metadata.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text(PreviewFixtures.direction.summary)
                                .font(XuechengTypography.capabilityTitle.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text("当前阶段 · \(PreviewFixtures.learner.currentStage)")
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(25)
                    }
                    .padding(.top, 31)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("最近的变化")
                            .font(XuechengTypography.metadata.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        Text(PreviewFixtures.learner.recentChange)
                            .font(XuechengTypography.sectionTitle.font)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                        Text("一次小小的进步，也会留在成长的路上。")
                            .font(XuechengTypography.caption.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 25)

                    Rectangle()
                        .fill(XuechengTheme.border(scheme))
                        .frame(height: 1)

                    VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                        Text("小程目前了解的我")
                            .font(XuechengTypography.sectionTitle.font)
                        Text(PreviewFixtures.learner.companionUnderstanding)
                            .font(XuechengTypography.body.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        Text("学习中的自己 · \(PreviewFixtures.learningSelfSummary)")
                            .font(XuechengTypography.caption.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                    .padding(.vertical, XuechengTheme.space24)

                    Rectangle()
                        .fill(XuechengTheme.border(scheme))
                        .frame(height: 1)

                    HStack(alignment: .top, spacing: 14) {
                        Image("BrandMark")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 30, height: 30)
                            .clipShape(RoundedRectangle(cornerRadius: XuechengTheme.radius12, style: .continuous))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 7) {
                            Text("一起成长")
                                .font(XuechengTypography.sectionTitle.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text("清晰地引路，在需要时陪伴。相处方式会随着你的反馈慢慢调整。")
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                    }
                    .padding(.top, 23)

                    NavigationLink(value: MeDestination.schedule) {
                        HStack {
                            Image(systemName: "calendar")
                            Text("日程")
                                .font(XuechengTypography.body.font)
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                        .padding(.vertical, XuechengTheme.space16)
                    }
                    .buttonStyle(.plain)

                    NavigationLink(value: MeDestination.settings) {
                        HStack(spacing: XuechengTheme.space12) {
                            Image(systemName: "gearshape")
                                .font(.body)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text("设置")
                                .font(XuechengTypography.body.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .padding(.vertical, 16)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 25)
                    .overlay(alignment: .top) {
                        Rectangle().fill(XuechengTheme.border(scheme)).frame(height: 1).padding(.top, 12)
                    }
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.bottom, XuechengTheme.space32)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .top, spacing: 0) { NativeHeader(title: "我的") }
        .toolbar(.hidden, for: .navigationBar)
    }
}

#Preview("我的 · 浅色") {
    NavigationStack {
        MeView()
            .navigationDestination(for: MeDestination.self) { _ in SettingsView() }
    }
    .preferredColorScheme(.light)
}

#Preview("我的 · 深色") {
    NavigationStack {
        MeView()
            .navigationDestination(for: MeDestination.self) { _ in SettingsView() }
    }
    .preferredColorScheme(.dark)
}
