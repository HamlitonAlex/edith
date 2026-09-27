import SwiftUI

struct HomeView: View {
    @Environment(\.colorScheme) private var scheme
    let onDiscuss: () -> Void

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("今天")
                            .font(XuechengTheme.font(.meta).weight(.semibold))
                            .tracking(1.6)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))

                        Text("今天，从这一步开始。")
                            .font(XuechengTheme.font(.display))
                            .tracking(-1.2)
                            .lineSpacing(2)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                            .padding(.top, 10)

                        Text("慢一点，也在向前。")
                            .font(XuechengTheme.font(.caption))
                            .lineSpacing(3)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            .padding(.top, 7)
                    }
                    .padding(.top, 34)

                    FloatingSurface(radius: XuechengTheme.nextStepRadius) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("下一步")
                                .font(XuechengTheme.font(.meta).weight(.semibold))
                                .tracking(1.6)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))

                            Text("练习递归的\n终止条件")
                                .font(XuechengTheme.font(.nextStepTitle))
                                .lineSpacing(1)
                                .tracking(-0.6)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                                .padding(.top, 19)

                            Text("上次练习时，判断什么时候停止还不太稳定。")
                                .font(XuechengTheme.font(.caption))
                                .lineSpacing(4)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.top, 14)

                            Button(action: onDiscuss) {
                                HStack {
                                    Text("开始 · 20 分钟")
                                    Spacer()
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 15, weight: .regular))
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(PrimaryButtonStyle())
                            .padding(.top, 25)
                        }
                        .padding(.horizontal, 28)
                        .padding(.top, 33)
                        .padding(.bottom, 30)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .overlay(alignment: .topTrailing) {
                        CompanionPresence(size: 52)
                            .padding(.trailing, 26)
                            .offset(y: -24)
                    }
                    .padding(.top, 45)

                    VStack(alignment: .leading, spacing: 14) {
                        SectionHeader(title: "学习路径")
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Python 基础")
                                .font(XuechengTheme.font(.sectionTitle))
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text("递归 · 正在推进")
                                .font(XuechengTheme.font(.caption))
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .padding(.top, 2)

                        Rectangle()
                            .fill(XuechengTheme.border(scheme))
                            .frame(height: 1)
                            .padding(.top, 8)

                        HStack(spacing: 11) {
                            Image(systemName: "calendar")
                                .font(.system(size: 16, weight: .regular))
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text("最近日程")
                                .font(XuechengTheme.font(.caption))
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Spacer(minLength: 4)
                            Text("14:00 · 编程练习")
                                .font(XuechengTheme.font(.caption))
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
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
    }
}

#Preview("Home · Light") {
    NavigationStack { HomeView(onDiscuss: {}) }
        .preferredColorScheme(.light)
}

#Preview("Home · Dark") {
    NavigationStack { HomeView(onDiscuss: {}) }
        .preferredColorScheme(.dark)
}
