import SwiftUI

struct SettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @AppStorage("appearance") private var appearance = Appearance.system.rawValue

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("让陪伴更像你。")
                        .font(XuechengTypography.pageTitle.font)
                        .tracking(XuechengTypography.pageTitle.letterSpacing)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                    Text("这些偏好会帮助小程理解何时靠近，何时留白。")
                        .font(XuechengTypography.secondaryBody.font)
                        .lineSpacing(XuechengTypography.secondaryBody.lineSpacing)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        .padding(.top, 7)

                    VStack(spacing: 27) {
                        settingsGroup("小程陪伴") {
                            settingsRow("相处方式", symbol: "heart")
                            Divider()
                            settingsRow("表达偏好", symbol: "text.bubble")
                        }
                        settingsGroup("学习偏好") {
                            settingsRow("学习偏好", symbol: "book")
                        }
                        settingsGroup("通知") {
                            settingsRow("提醒方式", symbol: "bell")
                        }
                        settingsGroup("外观") {
                            Picker("界面氛围", selection: $appearance) {
                                ForEach(Appearance.allCases) { option in
                                    Text(option.title).tag(option.rawValue)
                                }
                            }
                            .pickerStyle(.segmented)
                            .font(XuechengTypography.body.font)
                            .padding(.vertical, XuechengTheme.space8)
                        }
                        settingsGroup("数据与隐私") {
                            settingsRow("数据与隐私", symbol: "hand.raised")
                        }
                        settingsGroup("账户") {
                            settingsRow("账户信息", symbol: "person.crop.circle")
                        }
                    }
                    .padding(.top, 26)
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.top, XuechengTheme.space32)
                .padding(.bottom, XuechengTheme.space32)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("偏好与设置")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(.regularMaterial, for: .navigationBar)
        .toolbarColorScheme(scheme, for: .navigationBar)
        .accessibilityIdentifier("settings-screen")
    }

    private func settingsGroup<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(title)
                .font(XuechengTypography.caption.font)
                .tracking(XuechengTypography.caption.letterSpacing)
                .foregroundStyle(XuechengTheme.secondaryText(scheme))
            FrostedSurface(radius: XuechengTheme.radius20) {
                VStack(spacing: 0) { content() }
                    .padding(.horizontal, 18)
            }
        }
    }

    private func settingsRow(_ title: String, symbol: String) -> some View {
        HStack(spacing: XuechengTheme.space12) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .regular))
                .frame(width: 20)
            Text(title)
                .font(XuechengTypography.body.font)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .regular))
                .foregroundStyle(XuechengTheme.secondaryText(scheme))
        }
        .foregroundStyle(XuechengTheme.primaryText(scheme))
        .frame(minHeight: 48)
    }
}

#Preview("设置 · 浅色") {
    NavigationStack { SettingsView() }
        .preferredColorScheme(.light)
}

#Preview("设置 · 深色") {
    NavigationStack { SettingsView() }
        .preferredColorScheme(.dark)
}
