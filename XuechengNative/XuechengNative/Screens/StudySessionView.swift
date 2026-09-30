import SwiftUI

struct StudySessionView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let scheme: ColorScheme = .dark
    @State private var phase: StudySession.Phase = .understand
    @State private var answer = ""
    let onFinish: () -> Void

    var body: some View {
        ZStack {
            AmbientBackground(mode: .dark)
            ScrollView {
                VStack(alignment: .leading, spacing: XuechengTheme.space24) {
                    Text("学习过程 · \(phase.title)")
                        .font(XuechengTypography.metadata.font)
                        .foregroundStyle(XuechengTheme.secondaryText(scheme))

                    Text(PreviewFixtures.studySession.title)
                        .font(XuechengTypography.pageTitle.font)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))

                    Text(PreviewFixtures.studySession.prompts[phase] ?? "")
                        .font(XuechengTypography.body.font)
                        .lineSpacing(XuechengTypography.body.lineSpacing)
                        .foregroundStyle(XuechengTheme.primaryText(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                        .id(phase)
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .move(edge: .trailing).combined(with: .opacity)
                        )

                    if phase == .attempt || phase == .retry {
                        TextField("写下你的判断和理由", text: $answer, axis: .vertical)
                            .lineLimit(4...8)
                            .font(XuechengTypography.body.font)
                            .padding(XuechengTheme.space16)
                            .background {
                                FrostedSurface(radius: XuechengTheme.radius20) { Color.clear }
                            }
                            .accessibilityLabel("本次尝试")
                            .transition(
                                reduceMotion
                                    ? .opacity
                                    : .move(edge: .bottom).combined(with: .opacity)
                            )
                    }

                    if phase == .hint {
                        FrostedSurface(radius: XuechengTheme.radius20) {
                            Text("提示只帮助你找到判断方向。请想想：什么时候不必继续调用自己？")
                                .font(XuechengTypography.body.font)
                                .lineSpacing(XuechengTypography.body.lineSpacing)
                                .foregroundStyle(XuechengTheme.primaryText(scheme))
                                .padding(XuechengTheme.space24)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .move(edge: .bottom).combined(with: .opacity)
                        )
                    }

                    if phase == .evidence {
                        Text("这一轮只是界面演示。真实证据需要与作答、提示和评估记录关联后才能保存。")
                            .font(XuechengTypography.secondaryBody.font)
                            .lineSpacing(XuechengTypography.secondaryBody.lineSpacing)
                            .foregroundStyle(XuechengTheme.secondaryText(scheme))
                            .transition(.opacity)
                    }

                    Button(action: advance) {
                        HStack {
                            Text(phase == .evidence ? "查看学习结果" : "继续")
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled((phase == .attempt || phase == .retry) && answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .padding(.horizontal, XuechengTheme.pagePadding)
                .padding(.top, XuechengTheme.space32)
                .padding(.bottom, XuechengTheme.space32)
            }
            .scrollIndicators(.hidden)
        }
        .navigationTitle("学习过程")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .animation(reduceMotion ? nil : XuechengMotion.standardTransition, value: phase)
    }

    private func advance() {
        if phase == .evidence {
            withAnimation(reduceMotion ? nil : XuechengMotion.standardTransition) {
                onFinish()
            }
        } else if let next = StudySession.Phase(rawValue: phase.rawValue + 1) {
            withAnimation(reduceMotion ? nil : XuechengMotion.standardTransition) {
                phase = next
                answer = ""
            }
        }
    }
}

#Preview("学习过程 · 浅色") {
    NavigationStack { StudySessionView(onFinish: {}) }
        .preferredColorScheme(.light)
}

#Preview("学习过程 · 深色") {
    NavigationStack { StudySessionView(onFinish: {}) }
        .preferredColorScheme(.dark)
}
