import SwiftUI

struct TodayView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hasEntered = false
    var presenceIsActive: Bool = true

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("今天")
                            .font(XuechengTypography.metadata.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))

                        Text("今天，从这一步开始。")
                            .font(XuechengTypography.display.font)
                            .tracking(XuechengTypography.display.letterSpacing)
                            .lineSpacing(XuechengTypography.display.lineSpacing)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                            .padding(.top, 10)

                        Text("当前方向 · \(PreviewFixtures.direction.title)")
                            .font(XuechengTypography.secondaryBody.font)
                            .lineSpacing(XuechengTypography.secondaryBody.lineSpacing)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            .padding(.top, 7)
                    }
                    .padding(.top, 34)

                    NextStepCard(
                        step: PreviewFixtures.nextStep,
                        capabilityTitle: PreviewFixtures.capability(id: PreviewFixtures.nextStep.capabilityID)?.title ?? ""
                    ) {
                        NavigationLink(value: TodayDestination.study) {
                            HStack {
                                Text("开始学习")
                                Spacer()
                                Image(systemName: "arrow.right")
                                    .font(.system(size: XuechengTheme.primaryActionIconSize, weight: .regular))
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryButtonStyle())
                    }
                    .overlay(alignment: .topTrailing) {
                        CompanionPresence(
                            size: 52,
                            state: .resting,
                            isActive: presenceIsActive
                        )
                            .padding(.trailing, 26)
                            .offset(y: -24)
                    }
                    .opacity(hasEntered ? 1 : 0)
                    .offset(y: reduceMotion || hasEntered ? 0 : 20)
                    .padding(.top, 45)

                    XuechengSection("路径状态", spacing: XuechengTheme.compactSectionGap) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(PreviewFixtures.todayPathTitle)
                                .font(XuechengTypography.sectionTitle.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text(PreviewFixtures.todayPathSummary)
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .padding(.top, 2)

                        Rectangle()
                            .fill(XuechengTheme.border(scheme))
                            .frame(height: 1)
                            .padding(.top, 8)

                        HStack(spacing: 11) {
                            Image(systemName: "arrow.clockwise")
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text("复习提醒 · \(PreviewFixtures.todayReviewSummary)")
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .padding(.top, 4)

                        NavigationLink(value: TodayDestination.schedule) {
                            HStack(spacing: 11) {
                            Image(systemName: "calendar")
                                .font(.system(size: 16, weight: .regular))
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text("今日安排")
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Spacer(minLength: 4)
                            Text(PreviewFixtures.todayScheduleSummary)
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            }
                        }
                        .buttonStyle(XuechengQuietButtonStyle())
                        .padding(.top, 4)
                    }
                    .padding(.top, 30)
                    .padding(.horizontal, 3)
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.bottom, XuechengTheme.space32)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .top, spacing: 0) { NativeHeader(title: "今天") }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            guard !hasEntered else { return }
            withAnimation(reduceMotion ? nil : XuechengMotion.nextStepEntrance) {
                hasEntered = true
            }
        }
    }
}

#Preview("今天 · 浅色") {
    NavigationStack { TodayView() }
        .preferredColorScheme(.light)
}

#Preview("今天 · 深色") {
    NavigationStack { TodayView() }
        .preferredColorScheme(.dark)
}
