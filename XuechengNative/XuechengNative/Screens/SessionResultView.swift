import SwiftUI

struct SessionResultView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hasEntered = false
    let onReturn: () -> Void

    var body: some View {
        ZStack {
            AmbientBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: XuechengTheme.space24) {
                    Text("学习结果 · 示例")
                        .font(XuechengTypography.metadata.font)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))
                    Text("这次学习改变了什么？")
                        .font(XuechengTypography.pageTitle.font)
                        .lineSpacing(XuechengTypography.pageTitle.lineSpacing)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))

                    EvidenceCard(title: "新的表现", summary: PreviewFixtures.sessionResult.evidenceSummary)
                    EvidenceCard(title: "证据类型", summary: PreviewFixtures.sessionResult.evidenceTypes)
                    EvidenceCard(title: "独立性", summary: PreviewFixtures.sessionResult.independence)
                    EvidenceCard(title: "任务结果", summary: PreviewFixtures.sessionResult.taskResult)

                    SessionResultCard(result: PreviewFixtures.sessionResult)

                    Text("下一项验证：\(PreviewFixtures.sessionResult.nextVerification)")
                        .font(XuechengTypography.body.font)
                        .lineSpacing(XuechengTypography.body.lineSpacing)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))

                    Button(action: onReturn) {
                        Text("返回今天")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.top, XuechengTheme.space32)
                .padding(.bottom, XuechengTheme.space32)
                .opacity(hasEntered ? 1 : 0)
                .offset(y: reduceMotion || hasEntered ? 0 : 12)
                .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: hasEntered)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("学习结果")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onAppear {
            guard !hasEntered else { return }
            withAnimation(reduceMotion ? nil : XuechengMotion.standardTransition) {
                hasEntered = true
            }
        }
    }

}

#Preview("学习结果 · 浅色") {
    NavigationStack { SessionResultView(onReturn: {}) }
        .preferredColorScheme(.light)
}

#Preview("学习结果 · 深色") {
    NavigationStack { SessionResultView(onReturn: {}) }
        .preferredColorScheme(.dark)
}
