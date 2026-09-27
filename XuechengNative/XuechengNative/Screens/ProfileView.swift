import SwiftUI

struct ProfileView: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(spacing: 10) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 25, weight: .light))
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

                        Text("小程，正在慢慢了解你。")
                            .font(XuechengTheme.font(.pageTitle))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))

                        Text("她会记得重要的方向，也会看见每一次微小的进步。")
                            .font(XuechengTheme.font(.caption))
                            .lineSpacing(4)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 34)

                    NormalSurface(radius: XuechengTheme.radius24) {
                        VStack(alignment: .leading, spacing: 13) {
                            Text("你的方向")
                                .font(XuechengTheme.font(.meta).weight(.semibold))
                                .tracking(1.3)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text("把编程基础学扎实")
                                .font(XuechengTheme.font(.editorialQuote))
                                .lineSpacing(4)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(25)
                    }
                    .padding(.top, 31)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("最近，她看见")
                            .font(XuechengTheme.font(.meta).weight(.semibold))
                            .tracking(1.2)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        Text("你已经能解释递归终止条件，并完成一道基础练习。")
                            .font(XuechengTheme.font(.editorialEmphasis))
                            .lineSpacing(5)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                        Text("一次小小的进步，也会留在成长的路上。")
                            .font(XuechengTheme.font(.caption))
                            .lineSpacing(3)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 25)

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
                                .font(XuechengTheme.font(.editorialEmphasis))
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text("清晰地引路，在需要时陪伴。相处方式会随着你的反馈慢慢调整。")
                                .font(XuechengTheme.font(.caption))
                                .lineSpacing(4)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                    }
                    .padding(.top, 23)

                    NavigationLink(value: ProfileDestination.settings) {
                        HStack(spacing: XuechengTheme.space12) {
                            Image(systemName: "gearshape")
                                .font(.system(size: 17, weight: .regular))
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text("设置")
                                .font(XuechengTheme.font(.body))
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .medium))
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
        .safeAreaInset(edge: .top, spacing: 0) { NativeHeader(title: "我与小程") }
        .toolbar(.hidden, for: .navigationBar)
    }
}

#Preview("Profile · Light") {
    NavigationStack {
        ProfileView()
            .navigationDestination(for: ProfileDestination.self) { _ in SettingsView() }
    }
    .preferredColorScheme(.light)
}

#Preview("Profile · Dark") {
    NavigationStack {
        ProfileView()
            .navigationDestination(for: ProfileDestination.self) { _ in SettingsView() }
    }
    .preferredColorScheme(.dark)
}
