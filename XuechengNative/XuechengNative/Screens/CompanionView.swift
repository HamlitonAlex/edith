import SwiftUI

struct CompanionView: View {
    @Environment(\.colorScheme) private var scheme
    var presenceIsActive: Bool = true
    @State private var draft = ""

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    CompanionPresence(size: 82, state: .resting, isActive: presenceIsActive)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 35)
                        .padding(.bottom, 20)

                    VStack(spacing: 10) {
                        Text("你的学习伙伴")
                            .font(XuechengTypography.metadata.font)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        Text("和小程聊聊")
                            .font(XuechengTypography.pageTitle.font)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                        Text("一起理解现在的状态，再决定下一步。")
                            .font(XuechengTypography.caption.font)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .frame(maxWidth: .infinity)

                    UserMessageSurface {
                        Text(PreviewFixtures.conversation.userMessage)
                            .font(XuechengTypography.body.font)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 19)
                            .padding(.vertical, 17)
                    }
                    .frame(maxWidth: 280, alignment: .trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.top, 30)

                    AIMessageSurface {
                        VStack(alignment: .leading, spacing: 13) {
                            Text("小程")
                                .font(XuechengTypography.metadata.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))

                            Text(PreviewFixtures.conversation.companionMessage)
                                .font(XuechengTypography.body.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))

                            Text(PreviewFixtures.conversation.followUp)
                                .font(XuechengTypography.secondaryBody.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 23)
                        .padding(.vertical, 22)
                    }
                    .padding(.top, 15)

                    VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                        Text("可以从这里继续")
                            .font(XuechengTypography.sectionTitle.font)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                        ForEach(PreviewFixtures.conversation.suggestedPrompts, id: \.self) { prompt in
                            Button {
                                draft = prompt
                            } label: {
                                HStack {
                                    Text(prompt)
                                        .font(XuechengTypography.secondaryBody.font)
                                    Spacer()
                                    Image(systemName: "arrow.up.left")
                                }
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                                .padding(.vertical, XuechengTheme.space12)
                            }
                            .buttonStyle(XuechengQuietButtonStyle())
                            Divider()
                        }
                    }
                    .padding(.top, XuechengTheme.space24)

                    AIMessageSurface {
                        VStack(alignment: .leading, spacing: XuechengTheme.space12) {
                            Text("小程建议 · 尚未成为正式安排")
                                .font(XuechengTypography.metadata.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            Text(PreviewFixtures.conversation.scheduleSuggestion)
                                .font(XuechengTypography.body.font)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                            Text("这只是建议。确认后才会加入日程。")
                                .font(XuechengTypography.caption.font)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            NavigationLink(value: CompanionDestination.schedule) {
                                Text("查看日程")
                                    .font(XuechengTypography.buttonLabel.font)
                                    .foregroundStyle(XuechengTheme.primaryText(scheme))
                            }
                            .padding(.top, XuechengTheme.space8)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(XuechengTheme.space24)
                    }
                    .padding(.top, XuechengTheme.space24)
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.bottom, XuechengTheme.space24)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .top, spacing: 0) { NativeHeader(title: "小程") }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ChatInput(text: $draft)
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.top, XuechengTheme.space8)
                .padding(.bottom, XuechengTheme.space8)
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

#Preview("小程 · 浅色") {
    NavigationStack { CompanionView() }
        .preferredColorScheme(.light)
}

#Preview("小程 · 深色") {
    NavigationStack { CompanionView() }
        .preferredColorScheme(.dark)
}
