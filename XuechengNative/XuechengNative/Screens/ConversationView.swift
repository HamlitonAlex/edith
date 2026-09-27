import SwiftUI

struct ConversationView: View {
    @Environment(\.colorScheme) private var scheme
    @State private var draft = ""

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    CompanionPresence(size: 82)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 24)
                        .padding(.bottom, 18)

                    VStack(spacing: 10) {
                        Text("正在和你一起想")
                            .font(XuechengTheme.font(.meta).weight(.semibold))
                            .tracking(1.5)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        Text("今天想从哪里开始？")
                            .font(XuechengTheme.font(.pageTitle))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(XuechengTheme.primaryText(scheme))
                        Text("你可以聊聊现在的状态，也可以从下一步开始。")
                            .font(XuechengTheme.font(.caption))
                            .multilineTextAlignment(.center)
                            .lineSpacing(3)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    }
                    .frame(maxWidth: .infinity)

                    UserMessageSurface {
                        Text("昨天练习递归时，我总是不确定什么时候该停。")
                            .font(XuechengTheme.font(.userMessage))
                            .lineSpacing(4)
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
                                .font(XuechengTheme.font(.meta).weight(.semibold))
                                .tracking(1.2)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))

                            Text("上次练习时，你主要卡在终止条件。我们先从这里开始，一起看看什么时候该停下来。")
                                .font(XuechengTheme.font(.body))
                                .lineSpacing(5)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))

                            Text("先想想：如果条件一直不成立，会发生什么？")
                                .font(XuechengTheme.font(.caption))
                                .lineSpacing(4)
                                .foregroundStyle(XuechengTheme.secondaryText(scheme))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 23)
                        .padding(.vertical, 22)
                    }
                    .padding(.top, 15)
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.bottom, XuechengTheme.space24)
            }
            .scrollIndicators(.hidden)
        }
        .safeAreaInset(edge: .top, spacing: 0) { NativeHeader(title: "和小程对话") }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            ChatInput(text: $draft)
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.top, XuechengTheme.space8)
                .padding(.bottom, XuechengTheme.space8)
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

#Preview("Conversation · Light") {
    NavigationStack { ConversationView() }
        .preferredColorScheme(.light)
}

#Preview("Conversation · Dark") {
    NavigationStack { ConversationView() }
        .preferredColorScheme(.dark)
}
