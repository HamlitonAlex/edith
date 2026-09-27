import SwiftUI

struct SettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @AppStorage("appearance") private var appearance = Appearance.system.rawValue

    var body: some View {
        ZStack {
            AmbientBackground()

            List {
                Section("小程陪伴") {
                    settingsRow("相处方式", symbol: "heart")
                    settingsRow("表达偏好", symbol: "text.bubble")
                }

                Section("学习节奏") {
                    settingsRow("学习偏好", symbol: "book")
                }

                Section("通知") {
                    settingsRow("提醒方式", symbol: "bell")
                }

                Section("外观") {
                    Picker("界面氛围", selection: $appearance) {
                        ForEach(Appearance.allCases) { option in
                            Text(option.title).tag(option.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(XuechengTheme.surface(scheme).opacity(scheme == .dark ? 0.78 : 0.86))
                }

                Section("数据与隐私") {
                    settingsRow("数据与隐私", symbol: "hand.raised")
                }

                Section("账户") {
                    settingsRow("账户信息", symbol: "person.crop.circle")
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.clear)
            .listRowSeparatorTint(XuechengTheme.border(scheme))
            .tint(XuechengTheme.graphite(scheme))
        }
        .navigationTitle("设置")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(.regularMaterial, for: .navigationBar)
        .toolbarColorScheme(scheme, for: .navigationBar)
        .accessibilityIdentifier("settings-screen")
    }

    private func settingsRow(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(XuechengTheme.font(.body))
            .foregroundStyle(XuechengTheme.primaryText(scheme))
            .listRowBackground(XuechengTheme.surface(scheme).opacity(scheme == .dark ? 0.78 : 0.86))
    }
}

#Preview("Settings · Light") {
    NavigationStack { SettingsView() }
        .preferredColorScheme(.light)
}

#Preview("Settings · Dark") {
    NavigationStack { SettingsView() }
        .preferredColorScheme(.dark)
}
